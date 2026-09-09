import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { modernPackageSpecifier } from '../../../ultramodern-package-source';
import type { ResolvedPackageSource } from '../../../ultramodern-workspace/types';
import hashes from './api-artifact-hashes';
import { type MigrationIo, readJsonFile } from './io';

const owner = '@modern-js/bff-effect/microvertical-api';
const baselinePath =
  'packages/shared-contracts/src/microvertical-api-baseline.ts';
const publicNames = new Set([
  'MicroVerticalBuildMarkerSchema',
  'MicroVerticalReadinessSchema',
  'MicroVerticalOperationSourceSchema',
  'MicroVerticalOperationContextSchema',
  'createMicroVerticalOperationContext',
  'microVerticalOperationAttributes',
  'MicroVerticalBuildMarker',
  'MicroVerticalReadiness',
  'MicroVerticalOperationSource',
  'MicroVerticalOperationContext',
]);
/** Frozen release fingerprints, not mutable consumer ownership metadata. */
export const retiredApiArtifacts = Object.entries(hashes).flatMap(
  ([relativePath, versions]) => [
    { relativePath, hashes: versions.map(version => version.sha256) },
    ...(relativePath.endsWith('.mts')
      ? [
          {
            relativePath: relativePath.replace(/\.mts$/u, '.mjs'),
            hashes: versions.map(version => version.sha256),
          },
        ]
      : []),
  ],
);

function workspaceFiles(
  root: string,
  directory = '',
  retiringBaseline = true,
): string[] {
  const excluded = new Set([
    '.git',
    '.nx',
    '.output',
    'node_modules',
    'dist',
    'coverage',
  ]);
  return fs
    .readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap(entry => {
      if (excluded.has(entry.name)) return [];
      const relativePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        // Never inspect or rewrite linked consumer source, even when its target is local.
        if (
          retiringBaseline ||
          entry.name.match(/\.(?:[cm]?[jt]sx?|json)$/u) ||
          ['apps', 'verticals', 'packages', 'scripts'].includes(entry.name)
        )
          throw new Error(
            `API migration conflict: ${relativePath} is a symbolic link; consumer files were not changed.`,
          );
        return [];
      }
      return entry.isDirectory()
        ? workspaceFiles(root, relativePath, retiringBaseline)
        : [relativePath];
    });
}

/** Root namespace consumers cannot be rewritten from a static named import list. */
function hasUnsupportedRootReference(
  value: unknown,
  packageName: string,
  staticSources: ReadonlySet<number>,
): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value))
    return value.some(item =>
      hasUnsupportedRootReference(item, packageName, staticSources),
    );
  const node = value as Record<string, unknown>;
  if (
    node.type === 'StringLiteral' &&
    node.value === packageName &&
    !staticSources.has(node.start as number)
  )
    return true;
  if (
    node.type === 'TemplateElement' &&
    (node.value as { cooked?: string } | undefined)?.cooked === packageName
  )
    return true;
  return Object.values(node).some(item =>
    hasUnsupportedRootReference(item, packageName, staticSources),
  );
}

/** Preflight every retired file and supported import before making any writes. */
export function migratePackageOwnedApiArtifacts(
  io: MigrationIo,
  scope: string,
  packageSource: ResolvedPackageSource,
) {
  const removals = new Set<string>();
  const edits = new Map<string, string>();
  const manifestFiles = new Set<string>();
  const sharedName = `@${scope}/shared-contracts`;
  const sharedManifestPath = 'packages/shared-contracts/package.json';
  const conflict = (file: string, reason: string): never => {
    throw new Error(
      `API migration conflict: ${file}: ${reason}; consumer files were not changed.`,
    );
  };
  for (const artifact of retiredApiArtifacts) {
    // lstat on the leaf follows directory links, so prove every path segment first.
    let ancestor = io.workspaceRoot;
    for (const segment of artifact.relativePath.split('/')) {
      ancestor = path.join(ancestor, segment);
      if (fs.lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink())
        conflict(
          artifact.relativePath,
          `symbolic link at ${path.relative(io.workspaceRoot, ancestor)}`,
        );
    }
    const file = path.join(io.workspaceRoot, artifact.relativePath);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) continue;
    if (!stat.isFile() || stat.isSymbolicLink())
      conflict(artifact.relativePath, 'generated ownership cannot be proven');
    const digest = createHash('sha256')
      .update(fs.readFileSync(file))
      .digest('hex');
    if (!artifact.hashes.includes(digest))
      conflict(
        artifact.relativePath,
        'customized framework copy has no known released hash',
      );
    removals.add(artifact.relativePath);
  }
  const files = workspaceFiles(
    io.workspaceRoot,
    '',
    removals.has(baselinePath),
  );
  const sharedManifest = files.includes(sharedManifestPath)
    ? readJsonFile(path.join(io.workspaceRoot, sharedManifestPath))
    : undefined;
  const oldExport = sharedManifest?.exports?.['./microvertical-api-baseline'];
  if (
    oldExport !== undefined &&
    oldExport !== './src/microvertical-api-baseline.ts'
  )
    conflict(sharedManifestPath, 'custom baseline export target');
  if (oldExport !== undefined && !removals.has(baselinePath))
    conflict(
      sharedManifestPath,
      'baseline export has no proven generated implementation',
    );
  let rootExportsBaseline = false;
  const indexPath = 'packages/shared-contracts/src/index.ts';
  // The earlier generated public barrel is supported, but an authored reexport
  // with a renamed public symbol requires an explicit consumer decision.
  if (files.includes(indexPath)) {
    const source = fs.readFileSync(
      path.join(io.workspaceRoot, indexPath),
      'utf8',
    );
    if (source.includes('microvertical-api-baseline')) {
      const rootExport =
        typeof sharedManifest?.exports === 'string'
          ? sharedManifest.exports
          : sharedManifest?.exports?.['.'];
      if (
        sharedManifest?.name !== sharedName ||
        rootExport !== './src/index.ts'
      )
        conflict(
          sharedManifestPath,
          'root export must identify the generated ./src/index.ts barrel before migrating its public names',
        );

      const ast = parse(source, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      const ranges: Array<[number, number]> = [];
      for (const statement of ast.program.body) {
        if (
          (statement.type === 'ExportAllDeclaration' ||
            statement.type === 'ExportNamedDeclaration') &&
          statement.source?.value.match(
            /^\.\/microvertical-api-baseline(?:\.ts)?$/u,
          )
        ) {
          if (!removals.has(baselinePath))
            conflict(
              indexPath,
              'baseline barrel has no proven generated implementation',
            );
          if (
            statement.type === 'ExportNamedDeclaration' &&
            statement.specifiers.some(
              (specifier: any) =>
                specifier.type !== 'ExportSpecifier' ||
                specifier.local.name !== specifier.exported.name ||
                !publicNames.has(specifier.local.name),
            )
          )
            conflict(indexPath, 'custom baseline barrel aliases');
          ranges.push([statement.start!, statement.end!]);
          rootExportsBaseline = true;
        }
      }
      for (const statement of ast.program.body) {
        if (
          statement.type !== 'ExportNamedDeclaration' ||
          statement.source?.value.includes('microvertical-api-baseline')
        )
          continue;
        const declaration = statement.declaration;
        const names =
          declaration?.type === 'VariableDeclaration'
            ? declaration.declarations.flatMap(value =>
                value.id.type === 'Identifier' ? [value.id.name] : [],
              )
            : declaration &&
                'id' in declaration &&
                declaration.id?.type === 'Identifier'
              ? [declaration.id.name]
              : [];
        names.push(
          ...statement.specifiers.flatMap(specifier =>
            'exported' in specifier
              ? [
                  specifier.exported.type === 'Identifier'
                    ? specifier.exported.name
                    : specifier.exported.value,
                ]
              : [],
          ),
        );
        if (names.some(name => publicNames.has(name)))
          conflict(indexPath, 'authored export shadows a baseline public name');
      }
      if (
        rootExportsBaseline &&
        hasUnsupportedRootReference(ast, sharedName, new Set())
      )
        conflict(indexPath, 'unsupported root module reference');
      let updated = source;
      for (const [start, end] of ranges.reverse())
        updated = updated.slice(0, start) + updated.slice(end);
      if (updated.includes('microvertical-api-baseline'))
        conflict(indexPath, 'unsupported baseline barrel reference');
      edits.set(indexPath, updated);
    }
  }
  for (const relativePath of files) {
    if (
      removals.has(baselinePath) &&
      relativePath.endsWith('.json') &&
      relativePath !== sharedManifestPath
    ) {
      const content = fs.readFileSync(
        path.join(io.workspaceRoot, relativePath),
        'utf8',
      );
      if (
        content.includes('microvertical-api-baseline') ||
        (rootExportsBaseline &&
          relativePath.includes('tsconfig') &&
          content.includes('shared-contracts/src'))
      ) {
        conflict(
          relativePath,
          'custom export or path mapping refers to the retired public surface',
        );
      }
    }
    if (
      removals.has(relativePath) ||
      relativePath === indexPath ||
      !/\.[cm]?[jt]sx?$/u.test(relativePath)
    )
      continue;
    const source = fs.readFileSync(
      path.join(io.workspaceRoot, relativePath),
      'utf8',
    );
    if (
      !rootExportsBaseline &&
      !source.includes('microvertical-api-baseline') &&
      !source.includes(sharedName)
    )
      continue;
    let ast;
    try {
      ast = parse(source, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx'],
      });
    } catch {
      conflict(
        relativePath,
        'cannot parse a source that references the old API package',
      );
    }
    const replacements: Array<{ start: number; end: number; text: string }> =
      [];
    const staticRootSources = new Set<number>();
    for (const statement of ast!.program.body) {
      if (
        statement.type !== 'ImportDeclaration' &&
        statement.type !== 'ExportNamedDeclaration' &&
        statement.type !== 'ExportAllDeclaration'
      )
        continue;
      const target = statement.source?.value;
      if (statement.type === 'ImportDeclaration' && target === sharedName)
        staticRootSources.add(statement.source.start!);
      if (!target) continue;
      const direct =
        target === `${sharedName}/microvertical-api-baseline` ||
        (target.startsWith('.') &&
          path.resolve(
            io.workspaceRoot,
            path.dirname(relativePath),
            target.replace(/\.(?:ts|js)$/u, ''),
          ) ===
            path.resolve(io.workspaceRoot, baselinePath.replace(/\.ts$/u, '')));
      const fromRoot = target === sharedName && rootExportsBaseline;
      if (!direct && !fromRoot) continue;
      if (!removals.has(baselinePath))
        conflict(
          relativePath,
          'old baseline reference has no proven generated owner',
        );
      if (statement.type !== 'ImportDeclaration') {
        conflict(
          relativePath,
          'authored reexport must be migrated explicitly before retiring its public surface',
        );
        continue;
      }
      const imported = statement.specifiers.filter(
        (specifier: any) =>
          specifier.type === 'ImportSpecifier' &&
          publicNames.has(specifier.imported.name ?? specifier.imported.value),
      );
      if (direct) {
        if (
          statement.specifiers.some(
            (specifier: any) =>
              specifier.type === 'ImportDefaultSpecifier' ||
              (specifier.type === 'ImportSpecifier' &&
                !publicNames.has(
                  specifier.imported.name ?? specifier.imported.value,
                )),
          )
        )
          conflict(relativePath, 'unknown baseline export');
        replacements.push({
          start: statement.source.start!,
          end: statement.source.end!,
          text: `'${owner}'`,
        });
      } else {
        if (
          statement.specifiers.some(
            specifier => specifier.type !== 'ImportSpecifier',
          )
        )
          conflict(
            relativePath,
            'root namespace/default imports have an ambiguous public surface',
          );
        if (imported.length === 0) continue;
        const retained = statement.specifiers.filter(
          specifier => !imported.includes(specifier),
        );
        const render = (specifiers: typeof imported, target: string) =>
          `import ${statement.importKind === 'type' ? 'type ' : ''}{ ${specifiers.map(specifier => source.slice(specifier.start!, specifier.end!)).join(', ')} } from '${target}';`;
        replacements.push({
          start: statement.start!,
          end: statement.end!,
          text: [
            render(imported, owner),
            ...(retained.length ? [render(retained, target)] : []),
          ].join('\n'),
        });
      }
      let directory = path.dirname(relativePath);
      while (
        !files.includes(path.join(directory, 'package.json')) &&
        directory !== '.'
      )
        directory = path.dirname(directory);
      if (!files.includes(path.join(directory, 'package.json')))
        conflict(relativePath, 'no owning package manifest');
      manifestFiles.add(path.join(directory, 'package.json'));
    }
    if (
      rootExportsBaseline &&
      hasUnsupportedRootReference(ast, sharedName, staticRootSources)
    )
      conflict(relativePath, 'unsupported root module reference');
    let updated = source;
    for (const replacement of replacements.toSorted(
      (a, b) => b.start - a.start,
    ))
      updated =
        updated.slice(0, replacement.start) +
        replacement.text +
        updated.slice(replacement.end);
    if (updated.includes('microvertical-api-baseline'))
      conflict(
        relativePath,
        'unsupported dynamic or non-import baseline reference',
      );
    if (updated !== source) edits.set(relativePath, updated);
  }
  // Custom commands may retain their own segments; replace only the exact old executable.
  const rootManifestPath = path.join(io.workspaceRoot, 'package.json');
  if (fs.existsSync(rootManifestPath)) {
    const rootManifest = readJsonFile(rootManifestPath);
    for (const [name, command] of Object.entries(rootManifest.scripts ?? {})) {
      if (typeof command !== 'string') continue;
      if (command.includes('check-ultramodern-api-boundaries')) {
        const updated = command.replace(
          /(^|\s&&\s)node (?:\.\/)?scripts\/check-ultramodern-api-boundaries\.m[jt]s(?=\s&&\s|$)/gu,
          '$1modern-api-check',
        );
        if (
          updated === command ||
          updated.includes('check-ultramodern-api-boundaries')
        )
          conflict('package.json', `unsupported ${name} checker command`);
        rootManifest.scripts[name] = updated;
      }
    }
    rootManifest.devDependencies ??= {};
    rootManifest.devDependencies['@modern-js/bff-effect'] =
      modernPackageSpecifier('@modern-js/bff-effect', packageSource);
    rootManifest.scripts ??= {};
    rootManifest.scripts['api:check'] ??= 'modern-api-check';
    rootManifest.scripts['api:check:files'] ??= 'modern-api-check-files';
    edits.set('package.json', `${JSON.stringify(rootManifest, null, 2)}\n`);
  }
  if (oldExport !== undefined) {
    delete sharedManifest.exports['./microvertical-api-baseline'];
    edits.set(
      sharedManifestPath,
      `${JSON.stringify(sharedManifest, null, 2)}\n`,
    );
  }
  for (const manifestFile of manifestFiles) {
    const manifest = JSON.parse(
      edits.get(manifestFile) ??
        fs.readFileSync(path.join(io.workspaceRoot, manifestFile), 'utf8'),
    );
    manifest.dependencies ??= {};
    manifest.dependencies['@modern-js/bff-effect'] = modernPackageSpecifier(
      '@modern-js/bff-effect',
      packageSource,
    );
    edits.set(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  for (const [file, content] of edits)
    io.write(path.join(io.workspaceRoot, file), content);
  for (const file of removals) io.remove(path.join(io.workspaceRoot, file));
  if (removals.size)
    io.log(
      `API infrastructure: retired ${removals.size} hash-proven generated files; imports now resolve ${owner}.`,
    );
}
