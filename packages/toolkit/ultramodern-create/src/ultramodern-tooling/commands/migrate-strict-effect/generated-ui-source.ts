import fs from 'node:fs';
import { parse } from '@babel/parser';
import { formatGeneratedSourceCandidates } from '../../../ultramodern-workspace/fs-io';
import type { MigrationIo } from './io';

/** Compare syntax rather than formatter output; JSX text remains significant. */
export function generatedUiSourceRequiresRewrite(
  existingSource: string,
  nextSource: string,
) {
  const ignored = new Set([
    'start',
    'end',
    'loc',
    'extra',
    'leadingComments',
    'trailingComments',
    'innerComments',
    'comments',
    'tokens',
  ]);
  const identity = (source: string) => {
    const program = parse(source, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
    }).program;
    const jsxText: string[] = [];
    const syntax = JSON.stringify(program, (key, value) => {
      if (ignored.has(key)) return undefined;
      if (value?.type === 'JSXText') {
        // JSX trims indentation around line breaks, but in-line spaces are
        // rendered content and must not be erased by formatter comparison.
        const lines: string[] = value.value.split(/\r\n|\n|\r/u);
        const text = lines
          .map((line, index) => {
            let normalized = line.replace(/\t/gu, ' ');
            if (index > 0) normalized = normalized.replace(/^ +/u, '');
            if (index < lines.length - 1)
              normalized = normalized.replace(/ +$/u, '');
            return normalized;
          })
          .filter(line => line.length > 0)
          .join(' ');
        if (text) jsxText.push(text);
      }
      return value;
    });
    return { syntax, jsxText: JSON.stringify(jsxText) };
  };
  try {
    const before = identity(existingSource);
    const after = identity(nextSource);
    if (before.syntax === after.syntax) return false;
    if (before.jsxText !== after.jsxText) return true;
    // Compare the actual approved formatter's output when its import sorting
    // changed declaration order. Never invent a sort for side-effect imports.
    const [existing, next] = formatGeneratedSourceCandidates([
      ['existing.tsx', existingSource],
      ['generated.tsx', nextSource],
    ]);
    return identity(existing).syntax !== identity(next).syntax;
  } catch {
    // Unparseable authored source has no proven generated identity.
    return true;
  }
}

export function writeGeneratedUiSourceIfChanged(
  io: MigrationIo,
  filePath: string,
  nextSource: string,
) {
  if (fs.existsSync(filePath)) {
    const existingSource = fs.readFileSync(filePath, 'utf-8');
    if (!generatedUiSourceRequiresRewrite(existingSource, nextSource)) {
      return false;
    }
    io.log(
      `${filePath} preserved consumer source: no exact historical generated transition was identified.`,
    );
    return false;
  }
  return io.writeGenerated(filePath, nextSource);
}
