import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yaml } from '@modern-js/utils';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { runMigrateStrictEffect } from '../src/ultramodern-tooling/commands/migrate-strict-effect';
import {
  runPnpmLockfileRefresh,
  runStagedTargetChecks,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/install';
import { MODULE_FEDERATION_VERSION } from '../src/ultramodern-workspace/versions';
import { writeNodeCommandFixture } from './helpers/node-command-fixture';
import { createWorkspace } from './helpers/workspace-kit';

const migrationVersion = '3.5.0-ultramodern.1';
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

type TreeEntry =
  | { mode: number; path: string; type: 'directory' }
  | { content: string; mode: number; path: string; type: 'file' }
  | { mode: number; path: string; target: string; type: 'symlink' };

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

function snapshotWorkspaceTree(workspaceDir: string) {
  const entries: TreeEntry[] = [];
  const rootMode = fs.lstatSync(workspaceDir).mode & 0o7777;
  entries.push({ mode: rootMode, path: '.', type: 'directory' });

  function visit(relativeDirectory: string) {
    const directory = path.join(workspaceDir, relativeDirectory);
    const children = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) =>
        Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)),
      );

    for (const child of children) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      const absolutePath = path.join(workspaceDir, relativePath);
      const stat = fs.lstatSync(absolutePath);
      const mode = stat.mode & 0o7777;

      if (stat.isDirectory()) {
        entries.push({ mode, path: relativePath, type: 'directory' });
        visit(relativePath);
      } else if (stat.isFile()) {
        entries.push({
          content: fs.readFileSync(absolutePath).toString('base64'),
          mode,
          path: relativePath,
          type: 'file',
        });
      } else if (stat.isSymbolicLink()) {
        entries.push({
          mode,
          path: relativePath,
          target: fs.readlinkSync(absolutePath),
          type: 'symlink',
        });
      } else {
        throw new Error(`Unsupported workspace entry type: ${relativePath}`);
      }
    }
  }

  visit('');
  const manifest = JSON.stringify(entries);
  return {
    digest: createHash('sha256').update(manifest).digest('hex'),
    entries,
  };
}

function installFakePnpm(
  tempRoot: string,
  lockfile = `lockfileVersion: '9.0'
importers: {}
packages: {}
snapshots: {}
`,
  options: {
    beforeExit?: string;
    exitCode?: number;
    requireLockfilePresent?: boolean;
  } = {},
) {
  const binDir = path.join(tempRoot, 'bin');
  const invocationLog = path.join(tempRoot, 'pnpm-invocations.log');
  writeNodeCommandFixture(
    binDir,
    'pnpm',
    `const fs = require('node:fs');
${options.requireLockfilePresent ? "if (!fs.existsSync('pnpm-lock.yaml')) process.exit(1);" : ''}
fs.appendFileSync(process.env.ULTRAMODERN_TEST_PNPM_LOG, process.argv.slice(2).join(' ') + '\\n');
fs.writeFileSync('pnpm-lock.yaml', ${JSON.stringify(lockfile)});
${options.beforeExit ?? ''}
process.exit(${options.exitCode ?? 0});
`,
  );
  return { binDir, invocationLog };
}

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

  for (const relativePath of retiredMetadataPaths) {
    fs.writeFileSync(
      path.join(workspaceDir, relativePath),
      `${relativePath}\n`,
    );
  }

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
  for (const key of retiredPackageSourceKeys) {
    assert.equal(
      Object.hasOwn(packageSource, key),
      false,
      `retired packageSource key ${key} must be removed`,
    );
  }
}

test('migration subprocesses preserve staged command order, nonzero exits and launch failures', () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migration-process-'),
  );
  const workspaceRoot = path.join(tempRoot, 'workspace with spaces');
  fs.mkdirSync(workspaceRoot);
  const context = { invocationCwd: workspaceRoot, workspaceRoot };
  const previousPath = process.env.PATH;
  const previousInvocationLog = process.env.ULTRAMODERN_TEST_PNPM_LOG;

  try {
    for (const command of ['modern-api-check', 'ultramodern-create']) {
      writeNodeCommandFixture(
        path.join(workspaceRoot, 'node_modules/.bin'),
        command,
        'process.exit(0);',
      );
    }
    const { binDir, invocationLog } = installFakePnpm(tempRoot);
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ''}`;
    process.env.ULTRAMODERN_TEST_PNPM_LOG = invocationLog;
    assert.equal(runStagedTargetChecks(context, 'install'), 0);
    assert.deepEqual(
      fs.readFileSync(invocationLog, 'utf8').trim().split('\n'),
      ['exec modern-api-check', 'exec ultramodern-create ultramodern validate'],
    );

    installFakePnpm(tempRoot, undefined, { exitCode: 23 });
    fs.rmSync(invocationLog);
    assert.equal(runStagedTargetChecks(context, 'install'), 23);
    assert.equal(
      fs.readFileSync(invocationLog, 'utf8').trim(),
      'exec modern-api-check',
    );
    assert.equal(runPnpmLockfileRefresh(context), 23);

    process.env.PATH = '';
    assert.throws(() => runPnpmLockfileRefresh(context), /ENOENT/u);
    assert.throws(() => runStagedTargetChecks(context, 'install'), /ENOENT/u);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousInvocationLog === undefined)
      delete process.env.ULTRAMODERN_TEST_PNPM_LOG;
    else process.env.ULTRAMODERN_TEST_PNPM_LOG = previousInvocationLog;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('source-checkout migrate uses workspace links and is byte-idempotent after install', async () => {
  const { tempRoot, workspaceDir } = createWorkspace('migration-idempotence', {
    tempPrefix: 'um-migration-idempotence-',
  });
  const previousPath = process.env.PATH;
  const previousInvocationLog = process.env.ULTRAMODERN_TEST_PNPM_LOG;

  try {
    const extension = seedRetiredMetadata(workspaceDir);
    const consumerToolMode =
      fs.statSync(path.join(workspaceDir, 'consumer-tool.sh')).mode & 0o7777;
    const { binDir, invocationLog } = installFakePnpm(tempRoot);
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ''}`;
    process.env.ULTRAMODERN_TEST_PNPM_LOG = invocationLog;

    for (const relativePath of retiredMetadataPaths) {
      assert.equal(fs.existsSync(path.join(workspaceDir, relativePath)), true);
    }

    const migrate = () =>
      runUltramodernToolingCli(['migrate-strict-effect'], workspaceDir);

    assert.equal(await migrate(), 0);
    const afterFirstMigration = snapshotWorkspaceTree(workspaceDir);

    const rootPackage = readJson(workspaceDir, 'package.json');
    assertCleanPackageSource(rootPackage.modernjs.packageSource, extension);
    assert.deepEqual(rootPackage.modernjs.packageSource, {
      consumerExtension: extension,
      strategy: 'workspace',
      config: './.modernjs/ultramodern.json',
    });

    const compactConfig = readJson(workspaceDir, '.modernjs/ultramodern.json');
    assertCleanPackageSource(compactConfig.packageSource, extension);
    assert.equal(compactConfig.packageSource.strategy, 'workspace');
    assert.equal(
      compactConfig.packageSource.modernPackageVersion,
      'workspace:*',
    );
    assert.equal(
      fs.existsSync(path.join(workspaceDir, '.modernjs/release-cohort.json')),
      false,
    );
    const pnpmWorkspace = yaml.load(
      fs.readFileSync(path.join(workspaceDir, 'pnpm-workspace.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    assert.equal(pnpmWorkspace.injectWorkspacePackages, true);
    assert.equal(pnpmWorkspace.linkWorkspacePackages, true);
    assert.equal(
      fs.existsSync(
        path.join(
          workspaceDir,
          `patches/@module-federation__dts-plugin@${MODULE_FEDERATION_VERSION}.patch`,
        ),
      ),
      true,
      'the first migration must materialize the DTS plugin patch before the idempotence snapshot',
    );
    assert.equal(
      fs.existsSync(
        path.join(
          workspaceDir,
          `patches/@module-federation__runtime-core@${MODULE_FEDERATION_VERSION}.patch`,
        ),
      ),
      true,
      'the first migration must materialize the runtime-core patch before the idempotence snapshot',
    );

    for (const relativePath of retiredMetadataPaths) {
      assert.equal(fs.existsSync(path.join(workspaceDir, relativePath)), false);
    }
    const consumerTool = afterFirstMigration.entries.find(
      entry => entry.path === 'consumer-tool.sh',
    );
    assert.deepEqual(consumerTool, {
      content: Buffer.from('#!/bin/sh\nexit 0\n').toString('base64'),
      mode: consumerToolMode,
      path: 'consumer-tool.sh',
      type: 'file',
    });

    assert.equal(await migrate(), 0);
    const afterSecondMigration = snapshotWorkspaceTree(workspaceDir);
    assert.deepEqual(afterSecondMigration.entries, afterFirstMigration.entries);
    assert.equal(
      afterSecondMigration.digest,
      afterFirstMigration.digest,
      'the complete workspace tree must be byte-identical after migration two',
    );
    assert.deepEqual(
      fs.readFileSync(invocationLog, 'utf-8').trim().split('\n'),
      [
        'install --no-frozen-lockfile --ignore-scripts',
        'install --no-frozen-lockfile --ignore-scripts',
      ],
    );
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousInvocationLog === undefined) {
      delete process.env.ULTRAMODERN_TEST_PNPM_LOG;
    } else {
      process.env.ULTRAMODERN_TEST_PNPM_LOG = previousInvocationLog;
    }
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
  const previousPath = process.env.PATH;
  const previousInvocationLog = process.env.ULTRAMODERN_TEST_PNPM_LOG;

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
    const { binDir, invocationLog } = installFakePnpm(tempRoot, undefined, {
      beforeExit: `fs.rmSync('package.json');
fs.chmodSync('consumer-tool.sh', 0o600);
fs.mkdirSync('.modernjs/failed-lock-refresh', { recursive: true });
fs.writeFileSync('.modernjs/failed-lock-refresh/artifact.txt', 'created by failed refresh\\n');`,
      exitCode: 23,
      requireLockfilePresent: true,
    });
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ''}`;
    process.env.ULTRAMODERN_TEST_PNPM_LOG = invocationLog;
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
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousInvocationLog === undefined) {
      delete process.env.ULTRAMODERN_TEST_PNPM_LOG;
    } else {
      process.env.ULTRAMODERN_TEST_PNPM_LOG = previousInvocationLog;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate CLI returns status 1 when async release-age validation rejects', async () => {
  const { tempRoot, workspaceDir } = createWorkspace(
    'migration-async-release-age-failure',
    { tempPrefix: 'um-migration-async-release-age-failure-' },
  );
  const previousPath = process.env.PATH;
  const previousInvocationLog = process.env.ULTRAMODERN_TEST_PNPM_LOG;

  try {
    const { binDir, invocationLog } = installFakePnpm(
      tempRoot,
      `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      unresolved-package:
        specifier: 1.0.0
        version: unresolved-package@1.0.0
packages: {}
snapshots: {}
`,
    );
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ''}`;
    process.env.ULTRAMODERN_TEST_PNPM_LOG = invocationLog;
    const before = snapshotWorkspaceTree(workspaceDir);

    assert.equal(
      await runUltramodernToolingCli(['migrate-strict-effect'], workspaceDir),
      1,
    );
    assert.deepEqual(snapshotWorkspaceTree(workspaceDir), before);
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousInvocationLog === undefined) {
      delete process.env.ULTRAMODERN_TEST_PNPM_LOG;
    } else {
      process.env.ULTRAMODERN_TEST_PNPM_LOG = previousInvocationLog;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
