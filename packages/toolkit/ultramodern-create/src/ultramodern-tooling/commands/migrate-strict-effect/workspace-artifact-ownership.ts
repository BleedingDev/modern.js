import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import {
  parseUltramodernReleaseCohort,
  type UltramodernReleaseCohort,
} from '../../../ultramodern-release-cohort';
import { formatGeneratedSourceCandidates } from '../../../ultramodern-workspace/fs-io';
import { historicalValidatorHashes } from './api-artifact-hashes';
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

/** Recognize the paired overlay transition from framework template blob 0206251369. */
function normalizeHistoricalOverlayPair(
  source: string,
  currentGeneratedSource: string,
): string {
  const options: Parameters<typeof parse>[1] = {
    sourceType: 'module',
    plugins: ['typescript'],
  };
  // The published 57e02ede template used both statements together. Matching a
  // name or just one statement is not ownership evidence.
  const historical = parse(
    `const readGeneratedContractView = config => {
  return synthesizeGeneratedContractFromCompact(config);
};
const generatedContract = readGeneratedContractView(ultramodernConfig);`,
    options,
  );
  const previous = parse(source, options);
  const current = parse(currentGeneratedSource, options);
  const declarationName = (node: any): string | undefined =>
    node.type === 'VariableDeclaration' &&
    node.kind === 'const' &&
    node.declarations.length === 1 &&
    node.declarations[0].id.type === 'Identifier'
      ? node.declarations[0].id.name
      : undefined;
  const syntaxIdentity = (node: unknown) =>
    JSON.stringify(node, (key, value) =>
      [
        'start',
        'end',
        'loc',
        'extra',
        'leadingComments',
        'trailingComments',
        'innerComments',
      ].includes(key)
        ? undefined
        : value,
    );
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const expected of historical.program.body) {
    const name = declarationName(expected);
    const oldStatements = previous.program.body.filter(
      node => declarationName(node) === name,
    );
    const newStatements = current.program.body.filter(
      node => declarationName(node) === name,
    );
    if (oldStatements.length !== 1 || newStatements.length !== 1) return source;
    const oldStatement = oldStatements[0]!;
    const newStatement = newStatements[0]!;
    if (syntaxIdentity(oldStatement) !== syntaxIdentity(expected))
      return source;
    // Historical statements contain no comments. Never erase an authored
    // comment inside a replaced span; comments outside it remain in source and
    // must pass the whole-file canonical comparison below.
    if (
      previous.comments?.some(
        comment =>
          comment.start! >= oldStatement.start! &&
          comment.end! <= oldStatement.end!,
      )
    )
      return source;
    replacements.push({
      start: oldStatement.start!,
      end: oldStatement.end!,
      text: currentGeneratedSource.slice(
        newStatement.start!,
        newStatement.end!,
      ),
    });
  }
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    source =
      source.slice(0, replacement.start) +
      replacement.text +
      source.slice(replacement.end);
  return source;
}

function withoutGeneratedData(
  source: string,
  binding?: string,
  currentGeneratedSource?: string,
) {
  if (!binding) return source;
  if (binding === 'workspaceValidationContract') {
    if (currentGeneratedSource)
      source = normalizeHistoricalOverlayPair(source, currentGeneratedSource);
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

const nativeCohortModule = '../.modernjs/release-cohort.json';

function validatorCohortSyntax(source: string) {
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
  const literals = new Map(
    constants.flatMap(declaration =>
      declaration.id.type === 'Identifier' &&
      declaration.init &&
      ['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(
        declaration.init.type,
      )
        ? [[declaration.id.name, declaration.init] as const]
        : [],
    ),
  );
  const value = (node: any): unknown => {
    if (node?.type === 'Identifier') node = literals.get(node.name);
    if (!node) throw new Error('release data is not static');
    if (
      ['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)
    )
      return node.value;
    if (node.type === 'NullLiteral') return null;
    if (node.type === 'ArrayExpression') return node.elements.map(value);
    if (node.type === 'ObjectExpression') {
      const entries: Array<[string, unknown]> = [];
      for (const property of node.properties) {
        if (
          property.type !== 'ObjectProperty' ||
          property.computed ||
          property.shorthand ||
          !['Identifier', 'StringLiteral'].includes(property.key.type)
        )
          throw new Error('release data contains authored expressions');
        const key = property.key.name ?? property.key.value;
        if (entries.some(([previous]) => previous === key))
          throw new Error('release data contains duplicate keys');
        entries.push([key, value(property.value)]);
      }
      return Object.fromEntries(entries);
    }
    throw new Error('release data is not literal');
  };
  const cohorts = constants.flatMap(declaration => {
    const kind = staticPropertyValue(declaration.init, 'kind');
    if (!kind) return [];
    try {
      if (value(kind) !== 'modernjs.ultramodern-workspace-validation-contract')
        return [];
    } catch {
      return [];
    }
    const cohort = staticPropertyValue(
      staticPropertyValue(declaration.init, 'cohort'),
      'releaseCohort',
    );
    return [cohort];
  });
  const imports = parsed.program.body.filter(
    statement =>
      statement.type === 'ImportDeclaration' &&
      statement.source.value === nativeCohortModule,
  );
  return { parsed, constants, cohorts, imports, value };
}

/** A recognized authored validator reads its one contract cohort from native JSON. */
export function recognizesReleaseCohortRead(source: string): boolean {
  try {
    const { cohorts, imports } = validatorCohortSyntax(source);
    if (cohorts.length !== 1 || imports.length !== 1) return false;
    const statement = imports[0];
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.importKind === 'type'
    )
      return false;
    const binding = statement.specifiers[0];
    return (
      statement.specifiers.length === 1 &&
      binding?.type === 'ImportDefaultSpecifier' &&
      statement.attributes?.length === 1 &&
      (statement.attributes[0].key.type === 'Identifier'
        ? statement.attributes[0].key.name
        : statement.attributes[0].key.value) === 'type' &&
      statement.attributes[0].value.value === 'json' &&
      cohorts[0].type === 'Identifier' &&
      cohorts[0].name === binding.local.name
    );
  } catch {
    return false;
  }
}

/** Extract data once; subsequent releases update JSON without touching this program. */
function refreshValidatorReleaseCohort(source: string) {
  if (recognizesReleaseCohortRead(source)) return source;
  const { parsed, constants, cohorts, imports, value } =
    validatorCohortSyntax(source);
  if (cohorts.length !== 1 || imports.length !== 0)
    throw new Error('expected one unambiguous literal contract cohort');
  const cohort = cohorts[0];
  parseUltramodernReleaseCohort(value(cohort));
  if (
    parsed.comments?.some(
      comment => comment.start! >= cohort.start && comment.end! <= cohort.end,
    )
  )
    throw new Error('release data contains authored comments');
  const names = new Set(
    parsed.tokens
      ?.filter(token => token.type.label === 'name')
      .map(token => token.value),
  );
  let binding = 'ultramodernReleaseCohortDocument';
  while (names.has(binding)) binding += '_';
  const edits = [{ start: cohort.start, end: cohort.end, content: binding }];
  // Remove only private literal data declarations whose sole readers were in
  // the extracted region; every externally used constant remains byte-identical.
  for (const declaration of constants) {
    if (
      declaration.id.type !== 'Identifier' ||
      !declaration.init ||
      !['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(
        declaration.init.type,
      )
    )
      continue;
    const identifier = declaration.id;
    const readers =
      parsed.tokens?.filter(
        token =>
          token.type.label === 'name' &&
          token.value === identifier.name &&
          token.start !== identifier.start,
      ) ?? [];
    if (
      !readers.length ||
      readers.some(
        token => token.start < cohort.start || token.end > cohort.end,
      )
    )
      continue;
    const statement = parsed.program.body.find(
      statement =>
        statement.type === 'VariableDeclaration' &&
        statement.declarations.length === 1 &&
        statement.declarations[0] === declaration,
    );
    if (
      !statement ||
      parsed.comments?.some(
        comment =>
          comment.start! >= statement.start! && comment.end! <= statement.end!,
      )
    )
      continue;
    edits.push({ start: statement.start!, end: statement.end!, content: '' });
  }
  for (const edit of edits.toSorted((left, right) => right.start - left.start))
    source =
      source.slice(0, edit.start) + edit.content + source.slice(edit.end);
  const insertion = parsed.program.interpreter?.end ?? 0;
  return (
    source.slice(0, insertion) +
    `${insertion ? '\n' : ''}import ${binding} from '${nativeCohortModule}' with { type: 'json' };\n` +
    source.slice(insertion)
  );
}

function isHistoricalValidator(source: string) {
  const parsed = parse(source, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  const contracts = parsed.program.body.flatMap(statement =>
    statement.type === 'VariableDeclaration' && statement.kind === 'const'
      ? statement.declarations.filter(
          declaration =>
            declaration.id.type === 'Identifier' &&
            declaration.id.name === 'workspaceValidationContract' &&
            declaration.init &&
            isLiteralData(declaration.init),
        )
      : [],
  );
  if (contracts.length !== 1) return false;
  contracts[0].init = { type: 'ObjectExpression', properties: [] };
  const omitted = new Set([
    'start',
    'end',
    'loc',
    'extra',
    'leadingComments',
    'trailingComments',
    'innerComments',
  ]);
  const identity = JSON.stringify(
    {
      body: parsed.program.body,
      comments: parsed.comments?.map(({ type, value }) => ({ type, value })),
    },
    (key, value) => (omitted.has(key) ? undefined : value),
  );
  const digest = createHash('sha256').update(identity).digest('hex');
  return historicalValidatorHashes.some(
    historical => historical.sha256 === digest,
  );
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
            (candidate.generatedDataBinding === 'workspaceValidationContract' &&
              isHistoricalValidator(source)) ||
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
          try {
            const migrated = refreshValidatorReleaseCohort(source);
            if (migrated !== source) io.write(filePath, migrated);
          } catch (cause) {
            throw new Error(
              `Workspace validator migration conflict: ${relativePath}: cannot extract native release data (${cause instanceof Error ? cause.message : String(cause)}). Preserve the authored checks and replace the embedded cohort with a default JSON import from ${nativeCohortModule} before retrying.`,
              { cause },
            );
          }
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
