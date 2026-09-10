import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { ensureSharedApiInfrastructure } from '../src/ultramodern-tooling/commands/migrate-strict-effect/shared-api-infrastructure';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
import { linkBuiltCodeTools } from './helpers/built-code-tools';
import { linkWorkspaceFormatterDependencies } from './helpers/workspace-kit';

const source = {
  strategy: 'workspace' as const,
  modernPackageVersion: '3.8.3',
};
const shared = 'packages/shared-contracts';
const write = (root: string, file: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
};
const read = (root: string, file: string) =>
  fs.readFileSync(path.join(root, file), 'utf8');
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-migration-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
const migrate = () => {
  const io = createMigrationIo(root, false);
  io.transaction(() => ensureSharedApiInfrastructure(io, 'warehouse', source));
};

test('shared API infrastructure is additive, byte-stable, and preserves consumer exports and handlers', () => {
  const business = 'export const business =  "consumer formatting";\n';
  const handler = 'export { default } from "./business-runtime.ts";\n';
  write(root, `${shared}/src/index.ts`, business);
  write(root, 'verticals/catalog/api/index.ts', handler);
  write(
    root,
    `${shared}/package.json`,
    JSON.stringify({
      name: '@warehouse/shared-contracts',
      exports: { '.': './src/index.ts', './business': './src/business.ts' },
      dependencies: { 'consumer-library': '1.2.3' },
    }),
  );
  migrate();
  const index = read(root, `${shared}/src/index.ts`);
  expect(index).toBe(business);
  expect(index).not.toContain('microvertical-api-baseline');
  expect(read(root, 'verticals/catalog/api/index.ts')).toBe(handler);
  expect(
    parse(read(root, `${shared}/src/effect-bff-runtime.ts`), {
      sourceType: 'module',
      plugins: ['typescript'],
    }).program.body[0],
  ).toMatchObject({
    type: 'ExportNamedDeclaration',
    source: { value: '@modern-js/bff-effect/assembly' },
    specifiers: [
      {
        type: 'ExportSpecifier',
        local: { name: 'assembleEffectBffRuntime' },
        exported: { name: 'assembleEffectBffRuntime' },
      },
    ],
  });
  expect(
    fs.existsSync(path.join(root, shared, 'src/microvertical-api-baseline.ts')),
  ).toBe(false);
  expect(JSON.parse(read(root, `${shared}/package.json`))).toMatchObject({
    exports: {
      '.': './src/index.ts',
      './business': './src/business.ts',
      './server/effect-bff-runtime': './src/effect-bff-runtime.ts',
    },
    dependencies: {
      'consumer-library': '1.2.3',
      '@modern-js/bff-effect': 'workspace:*',
    },
  });
  const files = ['src/index.ts', 'src/effect-bff-runtime.ts', 'package.json'];
  const first = files.map(file => read(root, `${shared}/${file}`));
  migrate();
  expect(files.map(file => read(root, `${shared}/${file}`))).toEqual(first);
});

test('existing shared runtime and baseline implementations are never overwritten', () => {
  const existing = 'export const consumerOwned = true;\n';
  for (const name of ['effect-bff-runtime', 'microvertical-api-baseline']) {
    write(root, `${shared}/src/${name}.ts`, existing);
  }
  migrate();
  for (const name of ['effect-bff-runtime', 'microvertical-api-baseline']) {
    expect(read(root, `${shared}/src/${name}.ts`)).toBe(existing);
  }
});

test('dry-run plans missing shared infrastructure without changing consumer files', () => {
  const index = 'export const customer = true;\n';
  write(root, `${shared}/src/index.ts`, index);
  const io = createMigrationIo(root, true);
  io.transaction(() => ensureSharedApiInfrastructure(io, 'warehouse', source));
  expect(io.plan.some(line => line.includes('src/effect-bff-runtime.ts'))).toBe(
    true,
  );
  expect(
    io.plan.some(line => line.includes('src/microvertical-api-baseline.ts')),
  ).toBe(false);
  expect(read(root, `${shared}/src/index.ts`)).toBe(index);
  expect(fs.existsSync(path.join(root, shared, 'package.json'))).toBe(false);
});

test('ambiguous consumer root exports fail closed before any infrastructure writes', () => {
  const manifest = JSON.stringify({
    name: '@warehouse/shared-contracts',
    exports: { '.': './src/business.ts' },
  });
  write(root, `${shared}/package.json`, manifest);
  expect(migrate).toThrow('consumer exports were not overwritten');
  expect(read(root, `${shared}/package.json`)).toBe(manifest);
  expect(fs.existsSync(path.join(root, shared, 'src'))).toBe(false);
});

test.each([
  './server/effect-bff-runtime',
])('conflicting consumer %s export fails transactionally', subpath => {
  const manifest = JSON.stringify({
    name: '@warehouse/shared-contracts',
    exports: { '.': './src/index.ts', [subpath]: './src/business.ts' },
  });
  write(root, `${shared}/package.json`, manifest);
  write(root, `${shared}/src/index.ts`, 'export const business = true;\r\n');
  expect(migrate).toThrow('consumer exports were not overwritten');
  expect(read(root, `${shared}/package.json`)).toBe(manifest);
  expect(read(root, `${shared}/src/index.ts`)).toBe(
    'export const business = true;\r\n',
  );
  expect(
    fs.existsSync(path.join(root, shared, 'src/microvertical-api-baseline.ts')),
  ).toBe(false);
});

test.each([
  '',
  '\n',
  '\r\n',
])('migration retains root index bytes with terminator %j', terminator => {
  const index = `export const consumer =  "preserved";${terminator}`;
  write(root, `${shared}/src/index.ts`, index);
  migrate();
  expect(read(root, `${shared}/src/index.ts`)).toBe(index);
});

test('owning migration restores missing shared infrastructure without regenerating business API source', async () => {
  const workspace = path.join(root, 'workspace');
  generateUltramodernWorkspace({
    targetDir: workspace,
    packageName: 'warehouse',
    modernVersion: '3.8.3',
    enableTailwind: true,
    packageSource: { strategy: 'workspace' },
  });
  linkWorkspaceFormatterDependencies(workspace);
  addUltramodernVertical({
    workspaceRoot: workspace,
    name: 'catalog',
    modernVersion: '3.8.3',
  });
  fs.rmSync(path.join(workspace, shared, 'src/effect-bff-runtime.ts'));
  const business = 'export const businessContract = true;\n';
  write(workspace, `${shared}/src/index.ts`, business);
  const manifest = JSON.parse(read(workspace, `${shared}/package.json`));
  delete manifest.exports['./server/effect-bff-runtime'];
  delete manifest.dependencies['@modern-js/bff-effect'];
  write(workspace, `${shared}/package.json`, JSON.stringify(manifest));
  const handlers = [
    'api/index.ts',
    'shared/api.ts',
    'src/api/catalog-client.ts',
  ];
  const before = handlers.map(file =>
    read(workspace, `verticals/catalog/${file}`),
  );
  expect(
    await runUltramodernToolingCli(
      ['migrate-strict-effect', '--skip-install'],
      workspace,
    ),
  ).toBe(0);
  expect(
    handlers.map(file => read(workspace, `verticals/catalog/${file}`)),
  ).toEqual(before);
  expect(read(workspace, `${shared}/src/index.ts`)).toBe(business);
  expect(read(workspace, `${shared}/src/effect-bff-runtime.ts`)).toContain(
    "export { assembleEffectBffRuntime } from '@modern-js/bff-effect/assembly';",
  );
  expect(
    fs.existsSync(
      path.join(workspace, shared, 'src/microvertical-api-baseline.ts'),
    ),
  ).toBe(false);
  const require = createRequire(import.meta.url);
  for (const [name, target] of [
    [
      '@typescript/native',
      path.dirname(require.resolve('typescript/package.json')),
    ],
    ['@warehouse/shared-contracts', path.join(workspace, shared)],
  ]) {
    const destination = path.join(workspace, 'node_modules', name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(target, destination, 'dir');
  }
  linkBuiltCodeTools(path.join(workspace, 'node_modules'));
  fs.symlinkSync(
    path.resolve(__dirname, '../../../server/bff-effect'),
    path.join(workspace, 'node_modules/@modern-js/bff-effect'),
    'dir',
  );
  const checked = spawnSync(
    process.execPath,
    [path.resolve(__dirname, '../../code-tools/bin/modern-api-check.mjs')],
    {
      cwd: workspace,
      encoding: 'utf8',
      env: { ...process.env, ULTRAMODERN_WORKSPACE_ROOT: workspace },
    },
  );
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
});

test.each([
  ['packages', 'dir'],
  ['packages/shared-contracts', 'dir'],
  ['packages/shared-contracts/src', 'dir'],
  ['packages/shared-contracts/src/index.ts', 'file'],
  ['packages/shared-contracts/package.json', 'file'],
] as const)('shared infrastructure refuses consumer symlink %s without touching its target', (relativePath, kind) => {
  const content = 'consumer-owned bytes';
  const target = path.join(root, 'external', 'preserved');
  write(root, 'external/preserved', content);
  const link = path.join(root, relativePath);
  const destination = kind === 'dir' ? path.dirname(target) : target;
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(destination, link, kind);
  expect(migrate).toThrow('cannot write through a symbolic link');
  expect(fs.readFileSync(target, 'utf8')).toBe(content);
  expect(fs.readlinkSync(link)).toBe(destination);
  expect(fs.readdirSync(path.dirname(target))).toEqual(['preserved']);
});

test('a previous generated API workspace upgrades atomically to native package imports and validator-clean commands', async () => {
  const workspace = path.join(root, 'historical');
  generateUltramodernWorkspace({
    targetDir: workspace,
    packageName: 'warehouse',
    modernVersion: '3.8.3',
    enableTailwind: true,
    packageSource: { strategy: 'workspace' },
  });
  linkWorkspaceFormatterDependencies(workspace);
  addUltramodernVertical({
    workspaceRoot: workspace,
    name: 'inventory',
    modernVersion: '3.8.3',
  });
  const files = [
    [
      'packages/microvertical-api-baseline.ts',
      'packages/shared-contracts/src/microvertical-api-baseline.ts',
    ],
    [
      'workspace-scripts/check-ultramodern-api-boundaries.mts',
      'scripts/check-ultramodern-api-boundaries.mts',
    ],
    [
      'workspace-scripts/microvertical-api-baseline-boundary.mts',
      'scripts/microvertical-api-baseline-boundary.mts',
    ],
  ];
  for (const [template, file] of files)
    write(
      workspace,
      file,
      execFileSync(
        'git',
        [
          'show',
          `88271e79effb674c1ca5b93a6dc962e2926b51b0:packages/toolkit/ultramodern-create/templates/${template}`,
        ],
        { cwd: path.resolve(__dirname, '../../../..'), encoding: 'utf8' },
      ),
    );
  const contract = 'verticals/inventory/shared/api.ts';
  write(
    workspace,
    contract,
    read(workspace, contract).replaceAll(
      '@modern-js/bff-effect/microvertical-api',
      '@warehouse/shared-contracts/microvertical-api-baseline',
    ),
  );
  const manifest = JSON.parse(read(workspace, `${shared}/package.json`));
  manifest.exports['./microvertical-api-baseline'] =
    './src/microvertical-api-baseline.ts';
  write(workspace, `${shared}/package.json`, JSON.stringify(manifest));
  const rootPackage = JSON.parse(read(workspace, 'package.json'));
  rootPackage.scripts['api:check'] =
    'node ./scripts/check-ultramodern-api-boundaries.mts';
  delete rootPackage.scripts['api:check:files'];
  write(workspace, 'package.json', JSON.stringify(rootPackage));
  const validator = 'scripts/validate-ultramodern-workspace.mts';
  write(
    workspace,
    validator,
    read(workspace, validator).replace(
      "'modern-api-check'",
      "'node ./scripts/check-ultramodern-api-boundaries.mts'",
    ),
  );
  const handler = read(workspace, 'verticals/inventory/api/index.ts');
  expect(
    await runUltramodernToolingCli(
      ['migrate-strict-effect', '--skip-install'],
      workspace,
    ),
  ).toBe(0);
  expect(
    files.every(([, file]) => !fs.existsSync(path.join(workspace, file))),
  ).toBe(true);
  expect(read(workspace, contract)).toContain(
    '@modern-js/bff-effect/microvertical-api',
  );
  expect(read(workspace, 'verticals/inventory/api/index.ts')).toBe(handler);
  const checked = spawnSync(process.execPath, [validator], {
    cwd: workspace,
    encoding: 'utf8',
  });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
});
