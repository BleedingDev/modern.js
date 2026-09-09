import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { UltramodernReleaseCohort } from '../../../ultramodern-release-cohort';
import { formatGeneratedSourceCandidates } from '../../../ultramodern-workspace/fs-io';
import type { MigrationIo } from './io';

type ArtifactCandidate = {
  relativePath: string;
  content: string;
  legacyPath?: string;
  generatedDataBinding?: string;
};

function isLiteralData(
  node: any,
  literalIdentifiers?: ReadonlySet<string>,
): boolean {
  if (!node) return false;
  if (node.type === 'Identifier')
    return literalIdentifiers?.has(node.name) ?? false;
  if (
    [
      'StringLiteral',
      'NumericLiteral',
      'BooleanLiteral',
      'NullLiteral',
    ].includes(node.type)
  )
    return true;
  if (node.type === 'UnaryExpression')
    return node.operator === '-' && node.argument.type === 'NumericLiteral';
  if (node.type === 'ArrayExpression')
    return node.elements.every((element: any) =>
      isLiteralData(element, literalIdentifiers),
    );
  return (
    node.type === 'ObjectExpression' &&
    node.properties.every(
      (property: any) =>
        property.type === 'ObjectProperty' &&
        !property.computed &&
        !property.shorthand &&
        ['Identifier', 'StringLiteral', 'NumericLiteral'].includes(
          property.key.type,
        ) &&
        isLiteralData(property.value, literalIdentifiers),
    )
  );
}

function withoutGeneratedData(
  source: string,
  binding?: string,
  currentGeneratedSource?: string,
) {
  if (!binding) return source;
  if (binding === 'workspaceValidationContract') {
    source = source
      .replace(/^\s*'scripts\/check-ultramodern-api-boundaries\.mts',\n/mu, '')
      .replace(
        /rootPackage\.scripts\?\.\['api:check'\]\s*===\s*'node \.\/scripts\/check-ultramodern-api-boundaries\.mts'/u,
        "rootPackage.scripts?.['api:check'] === 'modern-api-check'",
      );
    // Only the exact historical assertion can adopt the current generated
    // postinstall block. The entire remaining validator must still match.
    const start = currentGeneratedSource?.indexOf(
      'const postinstall = rootPackage.scripts?.postinstall;',
    );
    const end = currentGeneratedSource?.indexOf(
      "assert(rootPackage.scripts?.['agents:refs:install']",
      start,
    );
    if (start !== undefined && end !== undefined && start >= 0 && end > start) {
      source = source.replace(
        /assert\(\s*rootPackage\.scripts\?\.postinstall\s*===\s*'node \.\/scripts\/bootstrap-agent-skills\.mts --postinstall && oxfmt \.',\s*'Root postinstall must run the default-on Codex skills bootstrap, format installed skills through the cross-platform ignore configuration, and leave reference repository installs explicit',?\s*\);/u,
        () => currentGeneratedSource!.slice(start, end).trimEnd(),
      );
    }
  }
  const parsed = parse(source, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  for (const statement of parsed.program.body) {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const')
      continue;
    for (const declaration of statement.declarations) {
      if (
        declaration.id.type !== 'Identifier' ||
        declaration.id.name !== binding ||
        !declaration.init ||
        !isLiteralData(declaration.init)
      )
        continue;
      return (
        source.slice(0, declaration.init.start!) +
        '{}' +
        source.slice(declaration.init.end!)
      );
    }
  }
  return source;
}

function staticPropertyValue(node: any, name: string) {
  if (node?.type !== 'ObjectExpression') return undefined;
  const keys = new Set<string>();
  let value;
  for (const property of node.properties) {
    if (
      property.type !== 'ObjectProperty' ||
      property.computed ||
      property.shorthand ||
      !['Identifier', 'StringLiteral'].includes(property.key.type)
    )
      return undefined;
    const key = property.key.name ?? property.key.value;
    if (keys.has(key)) return undefined;
    keys.add(key);
    if (key === name) value = property.value;
  }
  return value;
}

/** Replace only authenticated release data, never the surrounding authored program. */
function refreshValidatorReleaseCohort(
  source: string,
  releaseCohort: UltramodernReleaseCohort,
) {
  try {
    const parsed = parse(source, {
      sourceType: 'module',
      plugins: ['typescript'],
      tokens: true,
    });
    const constants = parsed.program.body.flatMap(statement =>
      statement.type === 'VariableDeclaration' && statement.kind === 'const'
        ? statement.declarations
        : [],
    );
    const matches = [];
    for (const statement of parsed.program.body) {
      if (
        statement.type !== 'VariableDeclaration' ||
        statement.kind !== 'const'
      )
        continue;
      for (const declaration of statement.declarations) {
        const kind = staticPropertyValue(declaration.init, 'kind');
        if (
          kind?.type !== 'StringLiteral' ||
          kind.value !== 'modernjs.ultramodern-workspace-validation-contract'
        )
          continue;
        const cohort = staticPropertyValue(
          staticPropertyValue(declaration.init, 'cohort'),
          'releaseCohort',
        );
        const schema = staticPropertyValue(cohort, 'schema');
        const schemaVersion = staticPropertyValue(cohort, 'schemaVersion');
        const version = staticPropertyValue(
          staticPropertyValue(cohort, 'release'),
          'version',
        );
        const versionConstant =
          version?.type === 'Identifier'
            ? constants.find(
                declaration =>
                  declaration.id.type === 'Identifier' &&
                  declaration.id.name === version.name &&
                  declaration.init?.type === 'StringLiteral',
              )
            : undefined;
        if (
          schema?.type === 'StringLiteral' &&
          schema.value === 'bleedingdev.ultramodern.release-cohort' &&
          schemaVersion?.type === 'NumericLiteral' &&
          schemaVersion.value === 1 &&
          isLiteralData(
            cohort,
            versionConstant ? new Set([version.name]) : undefined,
          )
        )
          matches.push({ cohort, version, versionConstant });
      }
    }
    if (matches.length !== 1) return source;
    const { cohort, version, versionConstant } = matches[0];
    let content = JSON.stringify(releaseCohort, null, 2);
    const edits = [];
    // A factored version constant remains authored if anything else uses it.
    // When the cohort is its sole reader, retain the binding and update its
    // literal value instead of leaving an unused declaration behind.
    if (
      versionConstant &&
      !parsed.tokens?.some(
        token =>
          token.type.label === 'name' &&
          token.value === version.name &&
          token.start !== versionConstant.id.start &&
          (token.start < cohort.start || token.end > cohort.end),
      )
    ) {
      content = content.replaceAll(
        `"version": ${JSON.stringify(releaseCohort.release.version)}`,
        `"version": ${version.name}`,
      );
      edits.push({
        start: versionConstant.init!.start!,
        end: versionConstant.init!.end!,
        content: JSON.stringify(releaseCohort.release.version),
      });
    }
    edits.push({ start: cohort.start, end: cohort.end, content });
    for (const edit of edits.toSorted(
      (left, right) => right.start - left.start,
    ))
      source =
        source.slice(0, edit.start) + edit.content + source.slice(edit.end);
    return source;
  } catch {
    return source;
  }
}

/** Protect authored replacements before any stage can delete or regenerate them. */
export function preserveConsumerWorkspaceArtifacts(
  io: MigrationIo,
  candidates: readonly ArtifactCandidate[],
) {
  const preservedPaths = new Set<string>();
  const recognizedPaths = new Map<string, boolean>();
  const physicalRoot = fs.realpathSync(io.workspaceRoot);
  const canonicalSources = formatGeneratedSourceCandidates(
    candidates.map(
      (candidate, index) =>
        [
          `canonical/${index}/${candidate.relativePath}`,
          withoutGeneratedData(
            candidate.content,
            candidate.generatedDataBinding,
          ),
        ] as const,
    ),
  );
  for (const [index, candidate] of candidates.entries()) {
    const paths = [candidate.relativePath, candidate.legacyPath].filter(
      (value): value is string => value !== undefined,
    );
    for (const relativePath of paths) {
      const filePath = path.join(io.workspaceRoot, relativePath);
      if (!fs.existsSync(filePath)) continue;
      const physicalRelative = path.relative(
        physicalRoot,
        fs.realpathSync(filePath),
      );
      if (
        physicalRelative === '..' ||
        physicalRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(physicalRelative)
      ) {
        throw new Error(
          `Refusing to inspect an artifact outside the workspace: ${relativePath}`,
        );
      }
      const source = fs.readFileSync(filePath, 'utf8');
      let recognized = source === candidate.content;
      if (!recognized) {
        try {
          const normalized = withoutGeneratedData(
            source,
            candidate.generatedDataBinding,
            candidate.content,
          );
          const canonical = canonicalSources[index];
          recognized =
            normalized === canonical ||
            formatGeneratedSourceCandidates([[relativePath, normalized]])[0] ===
              canonical;
        } catch {
          // An authored file that the generator cannot parse is still owned
          // by its author, not an invitation to overwrite it.
        }
      }
      recognizedPaths.set(
        relativePath,
        recognizedPaths.get(relativePath) === true || recognized,
      );
    }
  }
  for (const candidate of candidates) {
    const paths = [candidate.relativePath, candidate.legacyPath].filter(
      (value): value is string => value !== undefined,
    );
    if (
      paths.some(relativePath => recognizedPaths.get(relativePath) === false)
    ) {
      for (const pairedPath of paths) preservedPaths.add(pairedPath);
    }
  }
  const reported = new Set<string>();
  const isPreserved = (filePath: string) => {
    const relativePath = path
      .relative(io.workspaceRoot, filePath)
      .split(path.sep)
      .join('/');
    if (!preservedPaths.has(relativePath)) return false;
    if (!reported.has(relativePath)) {
      io.log(
        `${relativePath} preserved consumer-owned artifact: its canonical generated source does not match.`,
      );
      reported.add(relativePath);
    }
    return true;
  };
  return {
    preservedPaths,
    refreshReleaseCohort(releaseCohort?: UltramodernReleaseCohort) {
      if (!releaseCohort) return;
      for (const candidate of candidates) {
        if (candidate.generatedDataBinding !== 'workspaceValidationContract')
          continue;
        for (const relativePath of [
          candidate.relativePath,
          candidate.legacyPath,
        ]) {
          if (!relativePath || !preservedPaths.has(relativePath)) continue;
          const filePath = path.join(io.workspaceRoot, relativePath);
          if (!fs.existsSync(filePath)) continue;
          const source = fs.readFileSync(filePath, 'utf8');
          io.write(
            filePath,
            refreshValidatorReleaseCohort(source, releaseCohort),
          );
        }
      }
    },
    io: {
      ...io,
      write: (filePath: string, content: string) =>
        isPreserved(filePath) ? false : io.write(filePath, content),
      writeGenerated: (filePath: string, content: string) =>
        isPreserved(filePath) ? false : io.writeGenerated(filePath, content),
      remove: (filePath: string) =>
        isPreserved(filePath) ? false : io.remove(filePath),
    } satisfies MigrationIo,
  };
}
