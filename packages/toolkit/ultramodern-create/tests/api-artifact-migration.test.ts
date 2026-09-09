import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  migratePackageOwnedApiArtifacts,
  retiredApiArtifacts,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/api-artifact-migration';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { formatGeneratedSourceCandidates } from '../src/ultramodern-workspace/fs-io';

const source = {
  strategy: 'workspace' as const,
  modernPackageVersion: '3.8.3',
};
const baseline = 'packages/shared-contracts/src/microvertical-api-baseline.ts';
let root: string;
const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
};
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const snapshot = () =>
  Object.fromEntries(
    fs
      .readdirSync(root, { recursive: true })
      .filter(file => fs.statSync(path.join(root, String(file))).isFile())
      .map(file => [file, read(String(file))]),
  );
const migrate = (
  dryRun = false,
  scope?: Parameters<typeof migratePackageOwnedApiArtifacts>[3],
) => {
  const io = createMigrationIo(root, dryRun);
  io.transaction(() =>
    migratePackageOwnedApiArtifacts(io, 'warehouse', source, scope),
  );
  return io.plan;
};
const historical = (
  template: string,
  ref = '88271e79effb674c1ca5b93a6dc962e2926b51b0',
) =>
  execFileSync(
    'git',
    [
      'show',
      `${ref}:packages/toolkit/ultramodern-create/templates/${template}`,
    ],
    { cwd: path.resolve(__dirname, '../../../..'), encoding: 'utf8' },
  );
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-package-api-migration-'));
  write(
    'package.json',
    JSON.stringify({
      name: 'warehouse',
      scripts: {
        'api:check': 'node ./scripts/check-ultramodern-api-boundaries.mts',
        custom: 'echo preserved',
      },
    }),
  );
  write(
    'packages/shared-contracts/package.json',
    JSON.stringify({
      name: '@warehouse/shared-contracts',
      exports: {
        '.': './src/index.ts',
        './microvertical-api-baseline': './src/microvertical-api-baseline.ts',
        './business': './src/business.ts',
      },
    }),
  );
  write(
    'packages/shared-contracts/src/index.ts',
    'export const business = 1;\n',
  );
  write(baseline, historical('packages/microvertical-api-baseline.ts'));
  for (const name of [
    'check-ultramodern-api-boundaries',
    'microvertical-api-baseline-boundary',
  ])
    write(`scripts/${name}.mts`, historical(`workspace-scripts/${name}.mts`));
  write(
    'verticals/inventory/package.json',
    '{"name":"@warehouse/inventory","dependencies":{"custom":"1.2.3"}}',
  );
  write(
    'verticals/inventory/shared/api.ts',
    "import { MicroVerticalReadinessSchema as Ready } from '@warehouse/shared-contracts/microvertical-api-baseline';\nexport const consumer = Ready;\n",
  );
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('hash-proven historical copies retire with direct imports and a convergent second run', () => {
  const before = snapshot();
  const dryRun = migrate(true);
  expect(snapshot()).toEqual(before);
  expect(dryRun.filter(line => line.includes('would delete'))).toHaveLength(3);
  migrate();
  expect(
    retiredApiArtifacts.every(
      file => !fs.existsSync(path.join(root, file.relativePath)),
    ),
  ).toBe(true);
  expect(read('verticals/inventory/shared/api.ts')).toContain(
    "from '@modern-js/bff-effect/microvertical-api'",
  );
  expect(
    JSON.parse(read('verticals/inventory/package.json')).dependencies,
  ).toEqual({ custom: '1.2.3', '@modern-js/bff-effect': 'workspace:*' });
  expect(
    JSON.parse(read('packages/shared-contracts/package.json')).exports,
  ).toEqual({ '.': './src/index.ts', './business': './src/business.ts' });
  expect(JSON.parse(read('package.json')).scripts).toEqual({
    'api:check': 'modern-api-check',
    'api:check:files': 'modern-api-check-files',
    custom: 'echo preserved',
  });
  const first = snapshot();
  migrate();
  expect(snapshot()).toEqual(first);
});
test('formatted released copies and named public root imports migrate without touching business bindings', () => {
  for (const artifact of retiredApiArtifacts.filter(item =>
    fs.existsSync(path.join(root, item.relativePath)),
  ))
    write(
      artifact.relativePath,
      formatGeneratedSourceCandidates([
        [artifact.relativePath, read(artifact.relativePath)],
      ])[0],
    );
  write(
    'packages/shared-contracts/src/index.ts',
    "export const business = 1;\nexport * from './microvertical-api-baseline.ts';\n",
  );
  write(
    'verticals/inventory/shared/api.ts',
    "import { MicroVerticalReadinessSchema as Ready, business } from '@warehouse/shared-contracts';\nexport const consumer = [Ready, business];\n",
  );
  migrate();
  expect(read('verticals/inventory/shared/api.ts')).toContain(
    "import { business } from '@warehouse/shared-contracts';",
  );
  expect(read('verticals/inventory/shared/api.ts')).toContain(
    "import { MicroVerticalReadinessSchema as Ready } from '@modern-js/bff-effect/microvertical-api';",
  );
  expect(read('packages/shared-contracts/src/index.ts')).toBe(
    'export const business = 1;\n\n',
  );
});
test.each([
  'baseline',
  'checker',
  'export',
  'dynamic',
  'namespace',
  'reexport',
])('custom %s conflict leaves every byte untouched', kind => {
  if (kind === 'baseline')
    write(baseline, `${read(baseline)}\nexport const custom = true;`);
  if (kind === 'checker')
    write('scripts/check-ultramodern-api-boundaries.mts', '// custom checker');
  if (kind === 'export')
    write(
      'packages/shared-contracts/package.json',
      '{"exports":{"./microvertical-api-baseline":"./src/custom.ts"}}',
    );
  if (kind === 'dynamic')
    write(
      'verticals/inventory/shared/api.ts',
      "const api = await import('@warehouse/shared-contracts/microvertical-api-baseline');",
    );
  if (kind === 'namespace') {
    write(
      'packages/shared-contracts/src/index.ts',
      "export * from './microvertical-api-baseline.ts';",
    );
    write(
      'verticals/inventory/shared/api.ts',
      "import * as contracts from '@warehouse/shared-contracts';",
    );
  }
  if (kind === 'reexport')
    write(
      'verticals/inventory/shared/api.ts',
      "export * from '@warehouse/shared-contracts/microvertical-api-baseline';",
    );
  const before = snapshot();
  expect(() => migrate()).toThrow('API migration conflict');
  expect(snapshot()).toEqual(before);
});
test('failed downstream work rolls back removed files, imports and manifests', () => {
  const before = snapshot();
  const io = createMigrationIo(root, false);
  expect(() =>
    io.transaction(() => {
      migratePackageOwnedApiArtifacts(io, 'warehouse', source);
      throw new Error('install failed');
    }),
  ).toThrow('install failed');
  expect(snapshot()).toEqual(before);
});
test.each([
  'verticals/inventory/custom.ts',
  'packages/shared-contracts/src/custom.ts',
  'scripts/custom.mts',
])('linked source %s is rejected without following its target', linkedPath => {
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-external-'));
  try {
    fs.writeFileSync(path.join(external, 'api.ts'), 'preserved');
    fs.symlinkSync(path.join(external, 'api.ts'), path.join(root, linkedPath));
    expect(() => migrate()).toThrow('symbolic link');
    expect(fs.readFileSync(path.join(external, 'api.ts'), 'utf8')).toBe(
      'preserved',
    );
    expect(fs.existsSync(path.join(root, baseline))).toBe(true);
  } finally {
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test('unconfigured reference trees are untouched even when they contain source and directory links', () => {
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-reference-'));
  try {
    fs.writeFileSync(path.join(external, 'api.ts'), 'reference source');
    write('research/vendor/package.json', '{"name":"reference-only"}');
    write('research/vendor/untouched.ts', 'reference source');
    fs.symlinkSync(
      path.join(external, 'api.ts'),
      path.join(root, 'research/vendor/linked.ts'),
    );
    fs.symlinkSync(external, path.join(root, 'research/vendor/tree'), 'dir');
    migrate();
    expect(fs.existsSync(path.join(root, baseline))).toBe(false);
    expect(read('research/vendor/untouched.ts')).toBe('reference source');
    expect(
      fs
        .lstatSync(path.join(root, 'research/vendor/linked.ts'))
        .isSymbolicLink(),
    ).toBe(true);
    expect(
      fs.lstatSync(path.join(root, 'research/vendor/tree')).isSymbolicLink(),
    ).toBe(true);
    expect(fs.readFileSync(path.join(external, 'api.ts'), 'utf8')).toBe(
      'reference source',
    );
  } finally {
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test.each([
  'app',
  'bridge',
  'package',
  'pnpm',
] as const)('%s declarations keep custom consumer roots in the migration', kind => {
  const directory = 'services/catalog';
  write(`${directory}/package.json`, '{"name":"@warehouse/catalog"}');
  write(
    `${directory}/src/readiness.ts`,
    "import { MicroVerticalReadinessSchema } from '@warehouse/shared-contracts/microvertical-api-baseline';\nexport const readiness = MicroVerticalReadinessSchema;\n",
  );
  if (kind === 'package') {
    const manifest = JSON.parse(read('package.json'));
    manifest.workspaces = ['services/*'];
    write('package.json', JSON.stringify(manifest));
  }
  if (kind === 'pnpm')
    write('pnpm-workspace.yaml', 'packages:\n  - services/*\n');
  migrate(false, {
    appDirectories: kind === 'app' ? [directory] : [],
    workspacePatterns: kind === 'bridge' ? ['services/*'] : [],
  });
  expect(read(`${directory}/src/readiness.ts`)).toContain(
    "from '@modern-js/bff-effect/microvertical-api'",
  );
  expect(JSON.parse(read(`${directory}/package.json`)).dependencies).toEqual({
    '@modern-js/bff-effect': 'workspace:*',
  });
});

test.each([
  'app',
  'bridge',
  'package',
] as const)('%s declarations reject a linked ancestor before changing consumer files', kind => {
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-api-scoped-link-'),
  );
  try {
    fs.mkdirSync(path.join(external, 'catalog'));
    fs.writeFileSync(
      path.join(external, 'catalog/package.json'),
      '{"name":"linked"}',
    );
    fs.symlinkSync(external, path.join(root, 'services'), 'dir');
    if (kind === 'package') {
      const manifest = JSON.parse(read('package.json'));
      manifest.workspaces = ['services/catalog'];
      write('package.json', JSON.stringify(manifest));
    }
    const before = snapshot();
    expect(() =>
      migrate(false, {
        appDirectories: kind === 'app' ? ['services/catalog'] : [],
        workspacePatterns: kind === 'bridge' ? ['services/catalog/*'] : [],
      }),
    ).toThrow('services is a symbolic link');
    expect(snapshot()).toEqual(before);
  } finally {
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test.each([
  '**/*',
  '../outside/*',
  'services/../../outside/*',
])('unsafe workspace selector %s fails before deleting the baseline', pattern => {
  write('pnpm-workspace.yaml', `packages:\n  - '${pattern}'\n`);
  const before = snapshot();
  expect(() => migrate()).toThrow('safe source root');
  expect(snapshot()).toEqual(before);
});
test.each([
  'current',
  'retiring',
  'stale-local',
  'undeclared',
] as const)('external bridge scope preserves the %s baseline contract without visiting parent files', scenario => {
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-api-bridge-parent-'),
  );
  try {
    fs.writeFileSync(path.join(external, 'source.ts'), 'parent-owned source');
    fs.symlinkSync('missing.ts', path.join(external, 'linked.ts'));
    if (scenario !== 'retiring') migrate();
    const pattern = path.relative(root, external).replaceAll(path.sep, '/');
    const manifest = JSON.parse(read('package.json'));
    manifest.workspaces = [pattern];
    write('package.json', JSON.stringify(manifest));
    write('pnpm-workspace.yaml', `packages:\n  - '${pattern}'\n`);
    if (scenario === 'stale-local')
      write(
        'verticals/inventory/stale.ts',
        "import { MicroVerticalReadinessSchema } from '@warehouse/shared-contracts/microvertical-api-baseline';\n",
      );
    const before = snapshot();
    const run = () =>
      migrate(false, {
        workspacePatterns: scenario === 'undeclared' ? [] : [pattern],
      });
    if (scenario === 'current') {
      run();
      const after = snapshot();
      run();
      expect(snapshot()).toEqual(after);
    } else {
      expect(run).toThrow(
        scenario === 'retiring'
          ? 'cannot retire the API baseline while external bridge consumers'
          : scenario === 'stale-local'
            ? 'old baseline reference has no proven generated owner'
            : 'safe source root',
      );
      expect(snapshot()).toEqual(before);
    }
    expect(fs.readFileSync(path.join(external, 'source.ts'), 'utf8')).toBe(
      'parent-owned source',
    );
    expect(fs.readlinkSync(path.join(external, 'linked.ts'))).toBe(
      'missing.ts',
    );
  } finally {
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test('consumer path aliases are an explicit conflict before retiring the mapped module', () => {
  write(
    'tsconfig.json',
    '{"compilerOptions":{"paths":{"@business/baseline":["packages/shared-contracts/src/microvertical-api-baseline.ts"]}}}',
  );
  const before = snapshot();
  expect(() => migrate()).toThrow('custom export or path mapping');
  expect(snapshot()).toEqual(before);
});
test('known previous validator source refreshes with its generated data while authored changes remain protected', async () => {
  const { preserveConsumerWorkspaceArtifacts } = await import(
    '../src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership'
  );
  const current = `const workspaceValidationContract = { kind: 'modernjs.ultramodern-workspace-validation-contract', cohort: {} };\nconst files = [\n  'scripts/other.mts',\n];\nassert(rootPackage.scripts?.['api:check'] === 'modern-api-check', 'Root must expose api:check');\n`;
  const old = current
    .replace(
      "  'scripts/other.mts',",
      "  'scripts/check-ultramodern-api-boundaries.mts',\n  'scripts/other.mts',",
    )
    .replace(
      "=== 'modern-api-check'",
      "=== 'node ./scripts/check-ultramodern-api-boundaries.mts'",
    );
  write(
    'scripts/validate-ultramodern-workspace.mts',
    formatGeneratedSourceCandidates([
      ['scripts/validate-ultramodern-workspace.mts', old],
    ])[0],
  );
  const io = createMigrationIo(root, false);
  const candidate = {
    relativePath: 'scripts/validate-ultramodern-workspace.mts',
    content: current,
    generatedDataBinding: 'workspaceValidationContract',
  };
  const recognized = preserveConsumerWorkspaceArtifacts(io, [candidate]);
  expect(recognized.preservedPaths.size).toBe(0);
  recognized.io.write(path.join(root, candidate.relativePath), current);
  expect(read(candidate.relativePath)).toBe(current);
  write(candidate.relativePath, `${old}\ncustomAcceptance();`);
  const custom = preserveConsumerWorkspaceArtifacts(io, [candidate]);
  expect(custom.preservedPaths.has(candidate.relativePath)).toBe(true);
});

test('a custom root export cannot silently be replaced by a baseline name', () => {
  write(
    'packages/shared-contracts/src/index.ts',
    "export * from './microvertical-api-baseline.ts';\nexport const MicroVerticalReadinessSchema = 'custom';\n",
  );
  const before = snapshot();
  expect(() => migrate()).toThrow('shadows a baseline public name');
  expect(snapshot()).toEqual(before);
});

test.each([
  'verticals/inventory',
  'verticals/inventory/shared',
  'packages/shared-contracts',
  'packages/shared-contracts/src',
])('linked ancestor %s blocks retirement before any owned or linked bytes change', relativePath => {
  const actual = path.join(root, relativePath);
  const destination = path.join(root, 'linked-source');
  fs.renameSync(actual, destination);
  fs.symlinkSync(destination, actual, 'dir');
  const originalBaseline = fs.readFileSync(path.join(root, baseline), 'utf8');
  const originalCaller = read('verticals/inventory/shared/api.ts');
  const originalManifest = read('package.json');
  expect(() => migrate()).toThrow('symbolic link');
  expect(fs.readlinkSync(actual)).toBe(destination);
  expect(fs.readFileSync(path.join(root, baseline), 'utf8')).toBe(
    originalBaseline,
  );
  expect(read('verticals/inventory/shared/api.ts')).toBe(originalCaller);
  expect(read('package.json')).toBe(originalManifest);
});

test.each([
  './src/custom.ts',
  { import: './src/index.ts', require: './src/custom.ts' },
])('custom root export %j does not authorize replacing its authored names', target => {
  const manifest = JSON.parse(read('packages/shared-contracts/package.json'));
  manifest.exports['.'] = target;
  write('packages/shared-contracts/package.json', JSON.stringify(manifest));
  write(
    'packages/shared-contracts/src/index.ts',
    "export * from './microvertical-api-baseline.ts';\n",
  );
  write(
    'packages/shared-contracts/src/custom.ts',
    "export const MicroVerticalReadinessSchema = 'custom';\n",
  );
  write(
    'verticals/inventory/shared/api.ts',
    "import { MicroVerticalReadinessSchema } from '@warehouse/shared-contracts';\nexport const consumer = MicroVerticalReadinessSchema;\n",
  );
  const before = snapshot();
  expect(() => migrate()).toThrow('root export');
  expect(snapshot()).toEqual(before);
});

test.each([
  "const { MicroVerticalReadinessSchema } = await import('@warehouse/shared-contracts');",
  "const { MicroVerticalReadinessSchema } = require('@warehouse/shared-contracts');",
  'const contracts = await import(`@warehouse/shared-contracts`);',
  "const packageName = '@warehouse/shared-contracts'; const contracts = await import(packageName);",
])('unsupported root module reference fails before removing the public barrel: %s', content => {
  write(
    'packages/shared-contracts/src/index.ts',
    "export * from './microvertical-api-baseline.ts';\n",
  );
  write('verticals/inventory/shared/api.ts', content);
  const before = snapshot();
  expect(() => migrate()).toThrow('unsupported root module reference');
  expect(snapshot()).toEqual(before);
});
