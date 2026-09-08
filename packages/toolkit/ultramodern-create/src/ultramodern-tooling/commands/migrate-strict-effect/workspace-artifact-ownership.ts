import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { formatGeneratedSourceCandidates } from '../../../ultramodern-workspace/fs-io';
import type { MigrationIo } from './io';

type ArtifactCandidate = {
  relativePath: string;
  content: string;
  legacyPath?: string;
  generatedDataBinding?: string;
};

function isLiteralData(node: any): boolean {
  if (!node) return false;
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
    return node.elements.every(isLiteralData);
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
        isLiteralData(property.value),
    )
  );
}

function withoutGeneratedData(source: string, binding?: string) {
  if (!binding) return source;
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

/** Protect authored replacements before any stage can delete or regenerate them. */
export function preserveConsumerWorkspaceArtifacts(
  io: MigrationIo,
  candidates: readonly ArtifactCandidate[],
) {
  const preservedPaths = new Set<string>();
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
      if (!recognized) {
        for (const pairedPath of paths) preservedPaths.add(pairedPath);
      }
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
