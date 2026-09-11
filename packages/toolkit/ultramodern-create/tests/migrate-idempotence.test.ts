import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { runMigrateStrictEffect } from '../src/ultramodern-tooling/commands/migrate-strict-effect';
import { writeNodeCommandFixture } from './helpers/node-command-fixture';
import {
  createWorkspace,
  linkWorkspaceFormatterDependencies,
} from './helpers/workspace-kit';

const retiredPackageSourceKeys = [
  'generatedWorkspacePackages',
  'metadata',
  'modernPackages',
] as const;
const retiredMetadataPaths = [
  '.modernjs/ultramodern-generated-contract.json',
  '.modernjs/ultramodern-package-source.json',
  '.modernjs/ultramodern-workspace-template-manifest.json',
] as const;

function readJson(workspaceDir: string, relativePath: string) {
  return JSON.parse(
    fs.readFileSync(path.join(workspaceDir, relativePath), 'utf-8'),
  );
}

function writeJson(workspaceDir: string, relativePath: string, value: unknown) {
  fs.writeFileSync(
    path.join(workspaceDir, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

/** Full tree fingerprint: contents, permission bits and symlink targets. */
function snapshotWorkspaceTree(workspaceDir: string) {
  const entries: string[] = [];
  const visit = (relativeDirectory: string) => {
    const names = fs
      .readdirSync(path.join(workspaceDir, relativeDirectory))
      .sort();
    for (const name of names) {
      const rel = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const absolute = path.join(workspaceDir, rel);
      const stat = fs.lstatSync(absolute);
      const mode = (stat.mode & 0o7777).toString(8);
      if (stat.isDirectory()) {
        entries.push(`d ${mode} ${rel}`);
        visit(rel);
      } else if (stat.isSymbolicLink()) {
        entries.push(`l ${mode} ${rel} ${fs.readlinkSync(absolute)}`);
      } else if (stat.isFile()) {
        entries.push(
          `f ${mode} ${rel} ${fs.readFileSync(absolute).toString('base64')}`,
        );
      } else {
        throw new Error(`Unsupported workspace entry type: ${rel}`);
      }
    }
  };
  visit('');
  return {
    digest: createHash('sha256').update(entries.join('\n')).digest('hex'),
    entries,
  };
}

function installFakePnpm(
  tempRoot: string,
  options: {
    beforeExit?: string;
    exitCode?: number;
    requireLockfilePresent?: boolean;
  } = {},
) {
  const binDir = path.join(tempRoot, 'bin');
  const invocationLog = path.join(tempRoot, 'pnpm-invocations.log');
  const formatterRoot = path.join(tempRoot, 'formatter-providers');
  if (!fs.existsSync(formatterRoot))
    linkWorkspaceFormatterDependencies(formatterRoot);
  const formatterProviders = ['oxfmt', 'ultracite'].map(name => [
    name,
    fs.realpathSync(path.join(formatterRoot, 'node_modules', name)),
  ]);
  writeNodeCommandFixture(
    binDir,
    'pnpm',
    `const fs = require('node:fs');
${options.requireLockfilePresent ? "if (!fs.existsSync('pnpm-lock.yaml')) process.exit(1);" : ''}
fs.appendFileSync(process.env.ULTRAMODERN_TEST_PNPM_LOG, process.argv.slice(2).join(' ') + '\\n');
fs.writeFileSync('pnpm-lock.yaml', ${JSON.stringify(`lockfileVersion: '9.0'\nimporters: {}\npackages: {}\nsnapshots: {}\n`)});
if (process.argv[2] === 'install') {
  fs.mkdirSync('node_modules', { recursive: true });
  for (const [name, target] of ${JSON.stringify(formatterProviders)}) {
    if (!fs.existsSync('node_modules/' + name)) fs.symlinkSync(target, 'node_modules/' + name, process.platform === 'win32' ? 'junction' : 'dir');
  }
}
${options.beforeExit ?? ''}
process.exit(${options.exitCode ?? 0});
`,
  );
  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ''}`;
  process.env.ULTRAMODERN_TEST_PNPM_LOG = invocationLog;
}

function restoreEnv(previousPath?: string, previousLog?: string) {
  if (previousPath === undefined) delete process.env.PATH;
  else process.env.PATH = previousPath;
  if (previousLog === undefined) delete process.env.ULTRAMODERN_TEST_PNPM_LOG;
  else process.env.ULTRAMODERN_TEST_PNPM_LOG = previousLog;
}

/** Seeds a workspace that still carries the pre-migration metadata plus consumer-owned data. */
function seedRetiredMetadata(workspaceDir: string) {
  const extension = {
    consumer: 'kept',
    nested: { enabled: true, values: ['one', 'two'] },
  };
  const retired = {
    generatedWorkspacePackages: ['@modern-js/app-tools'],
    metadata: { source: 'retired' },
    modernPackages: { specifier: '3.2.0-ultramodern.108' },
  };

  const rootPackage = readJson(workspaceDir, 'package.json');
  rootPackage.modernjs.packageSource = {
    ...rootPackage.modernjs.packageSource,
    ...retired,
    consumerExtension: extension,
  };
  writeJson(workspaceDir, 'package.json', rootPackage);

  const compactConfig = readJson(workspaceDir, '.modernjs/ultramodern.json');
  compactConfig.packageSource = {
    ...compactConfig.packageSource,
    ...retired,
    consumerExtension: extension,
  };
  writeJson(workspaceDir, '.modernjs/ultramodern.json', compactConfig);

  for (const relativePath of retiredMetadataPaths)
    fs.writeFileSync(
      path.join(workspaceDir, relativePath),
      `${relativePath}\n`,
    );

  const consumerToolPath = path.join(workspaceDir, 'consumer-tool.sh');
  fs.writeFileSync(consumerToolPath, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(consumerToolPath, 0o751);
  return extension;
}

function assertCleanPackageSource(
  packageSource: Record<string, unknown>,
  extension: unknown,
) {
  assert.deepEqual(packageSource.consumerExtension, extension);
  for (const key of retiredPackageSourceKeys)
    assert.equal(
      Object.hasOwn(packageSource, key),
      false,
      `retired packageSource key ${key} must be removed`,
    );
}

test('source-checkout migrate drops retired metadata, keeps consumer data and is byte-idempotent', async () => {
  const { tempRoot, workspaceDir } = createWorkspace('migration-idempotence', {
    tempPrefix: 'um-migration-idempotence-',
  });
  const previousPath = process.env.PATH;
  const previousLog = process.env.ULTRAMODERN_TEST_PNPM_LOG;

  try {
    const extension = seedRetiredMetadata(workspaceDir);
    const consumerToolMode =
      fs.statSync(path.join(workspaceDir, 'consumer-tool.sh')).mode & 0o7777;
    installFakePnpm(tempRoot);

    const migrate = () =>
      runUltramodernToolingCli(['migrate-strict-effect'], workspaceDir);

    assert.equal(await migrate(), 0);
    const afterFirstMigration = snapshotWorkspaceTree(workspaceDir);

    assertCleanPackageSource(
      readJson(workspaceDir, 'package.json').modernjs.packageSource,
      extension,
    );
    const compactConfig = readJson(workspaceDir, '.modernjs/ultramodern.json');
    assertCleanPackageSource(compactConfig.packageSource, extension);
    assert.equal(
      compactConfig.packageSource.modernPackageVersion,
      'workspace:*',
      'a source checkout must keep linking workspace packages, not a published version',
    );
    for (const relativePath of retiredMetadataPaths)
      assert.equal(fs.existsSync(path.join(workspaceDir, relativePath)), false);
    assert.ok(
      afterFirstMigration.entries.includes(
        `f ${consumerToolMode.toString(8)} consumer-tool.sh ${Buffer.from(
          '#!/bin/sh\nexit 0\n',
        ).toString('base64')}`,
      ),
      'migration must not rewrite or re-chmod a consumer-owned script',
    );

    assert.equal(await migrate(), 0);
    assert.equal(
      snapshotWorkspaceTree(workspaceDir).digest,
      afterFirstMigration.digest,
      'the complete workspace tree must be byte-identical after migration two',
    );
  } finally {
    restoreEnv(previousPath, previousLog);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate fails before writes for malformed root package-source metadata', () => {
  const { tempRoot, workspaceDir } = createWorkspace(
    'migration-structural-failure',
    { tempPrefix: 'um-migration-structural-failure-' },
  );

  try {
    const rootPackage = readJson(workspaceDir, 'package.json');
    rootPackage.modernjs.packageSource = [];
    writeJson(workspaceDir, 'package.json', rootPackage);
    const before = snapshotWorkspaceTree(workspaceDir);

    assert.throws(
      () =>
        runMigrateStrictEffect(['--skip-install'], {
          invocationCwd: workspaceDir,
          workspaceRoot: workspaceDir,
        }),
      /package\.json modernjs\.packageSource must be an object\./u,
    );
    assert.deepEqual(snapshotWorkspaceTree(workspaceDir), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate restores the byte-identical tree when lock refresh exits nonzero', async () => {
  const { tempRoot, workspaceDir } = createWorkspace(
    'migration-lock-refresh-failure',
    { tempPrefix: 'um-migration-lock-refresh-failure-' },
  );
  linkWorkspaceFormatterDependencies(workspaceDir);
  const previousPath = process.env.PATH;
  const previousLog = process.env.ULTRAMODERN_TEST_PNPM_LOG;

  try {
    seedRetiredMetadata(workspaceDir);
    const staleLockfile = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      stale-package:
        specifier: 1.0.0
        version: stale-package@1.0.0
packages: {}
snapshots: {}
`;
    fs.writeFileSync(path.join(workspaceDir, 'pnpm-lock.yaml'), staleLockfile);
    installFakePnpm(tempRoot, {
      beforeExit: `fs.rmSync('package.json');
fs.chmodSync('consumer-tool.sh', 0o600);
fs.mkdirSync('.modernjs/failed-lock-refresh', { recursive: true });
fs.writeFileSync('.modernjs/failed-lock-refresh/artifact.txt', 'created by failed refresh\\n');`,
      exitCode: 23,
      requireLockfilePresent: true,
    });
    const before = snapshotWorkspaceTree(workspaceDir);

    assert.equal(
      await runUltramodernToolingCli(['migrate-strict-effect'], workspaceDir),
      23,
    );
    assert.deepEqual(snapshotWorkspaceTree(workspaceDir), before);
    assert.equal(
      fs.readFileSync(path.join(workspaceDir, 'pnpm-lock.yaml'), 'utf-8'),
      staleLockfile,
    );
  } finally {
    restoreEnv(previousPath, previousLog);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
