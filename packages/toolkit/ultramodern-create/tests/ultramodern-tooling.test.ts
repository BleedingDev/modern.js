import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { yaml } from '@modern-js/utils';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
import { MODULE_FEDERATION_VERSION } from '../src/ultramodern-workspace/versions';
import { linkWorkspaceFormatterDependencies } from './helpers/workspace-kit';

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

function scaffoldWorkspace(name: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-tooling-'));
  const workspaceDir = path.join(tempRoot, name);
  generateUltramodernWorkspace({
    targetDir: workspaceDir,
    packageName: name,
    modernVersion: '3.2.1',
    enableTailwind: true,
    packageSource: { strategy: 'workspace' },
  });
  linkWorkspaceFormatterDependencies(workspaceDir);
  return { tempRoot, workspaceDir };
}

function exists(workspaceDir: string, relativePath: string) {
  return fs.existsSync(path.join(workspaceDir, relativePath));
}

function writeRetiredRspackRscPatch(
  workspaceDir: string,
  relativePath: string,
) {
  const fixture = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../..',
      'tests/retired-rspack-rsc-0.0.3.patch.gz.base64',
    ),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(workspaceDir, relativePath),
    zlib.gunzipSync(Buffer.from(fixture.trim(), 'base64')),
  );
}

type CommandRecord = {
  args: string[];
  command: string;
  cwd: string;
  env: {
    MODERNJS_DEPLOY?: string;
    ULTRAMODERN_CLOUDFLARE_REQUIRE_PUBLIC_URLS?: string;
    ULTRAMODERN_ZEPHYR?: string;
  };
};

function installCommandRecorder(tempRoot: string) {
  const binDir = path.join(tempRoot, 'command-recorder-bin');
  const logPath = path.join(tempRoot, 'command-recorder.jsonl');
  const recorderPath = path.join(binDir, 'record-command.cjs');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    recorderPath,
    `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const [command, ...args] = process.argv.slice(2);
if (command === 'cross-env') {
  const env = { ...process.env };
  let commandIndex = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(args[commandIndex] ?? '')) {
    const assignment = args[commandIndex];
    const separator = assignment.indexOf('=');
    env[assignment.slice(0, separator)] = assignment.slice(separator + 1);
    commandIndex += 1;
  }
  const result = spawnSync(args[commandIndex], args.slice(commandIndex + 1), {
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}
const record = {
  args,
  command,
  cwd: process.cwd(),
  env: {
    MODERNJS_DEPLOY: process.env.MODERNJS_DEPLOY,
    ULTRAMODERN_CLOUDFLARE_REQUIRE_PUBLIC_URLS:
      process.env.ULTRAMODERN_CLOUDFLARE_REQUIRE_PUBLIC_URLS,
    ULTRAMODERN_ZEPHYR: process.env.ULTRAMODERN_ZEPHYR,
  },
};
fs.appendFileSync(process.env.ULTRAMODERN_TEST_COMMAND_LOG, JSON.stringify(record) + '\\n');

if (command === 'pnpm') {
  const scriptName = args[0] === 'run' ? args[1] : args[0];
  if (scriptName && !scriptName.startsWith('-') && !['exec', 'install'].includes(scriptName)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    if (typeof manifest.scripts?.[scriptName] !== 'string') {
      process.exit(127);
    }
  }
}

const invocation = command + ':' + (args[0] === 'run' ? args[1] : args[0] ?? '');
if (process.env.ULTRAMODERN_TEST_FAIL_INVOCATION === invocation) {
  process.exit(Number(process.env.ULTRAMODERN_TEST_FAIL_CODE ?? 1));
}
`,
    'utf-8',
  );
  fs.chmodSync(recorderPath, 0o755);
  for (const command of [
    'cross-env',
    'modern',
    'node',
    'oxfmt',
    'pnpm',
    'wrangler',
  ]) {
    const executablePath = path.join(binDir, command);
    fs.writeFileSync(
      executablePath,
      `#!/bin/sh\nexec "${process.execPath}" "${recorderPath}" ${command} "$@"\n`,
      { mode: 0o755 },
    );
    fs.writeFileSync(
      `${executablePath}.cmd`,
      `@echo off\r\n"${process.execPath}" "${recorderPath}" ${command} %*\r\n`,
      'utf-8',
    );
  }
  return { binDir, logPath };
}

function runRecordedPackageScript(
  tempRoot: string,
  workspaceDir: string,
  packageDir: string,
  scriptName: string,
  options: { failCode?: number; failInvocation?: string } = {},
) {
  const { binDir, logPath } = installCommandRecorder(
    fs.mkdtempSync(path.join(tempRoot, 'command-run-')),
  );
  const cwd = path.join(workspaceDir, packageDir);
  const packageJson = readJson(
    workspaceDir,
    path.join(packageDir, 'package.json'),
  );
  const script = packageJson.scripts?.[scriptName];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
    ULTRAMODERN_TEST_COMMAND_LOG: logPath,
    ...(options.failInvocation
      ? {
          ULTRAMODERN_TEST_FAIL_CODE: String(options.failCode ?? 1),
          ULTRAMODERN_TEST_FAIL_INVOCATION: options.failInvocation,
        }
      : {}),
  };
  if (process.platform === 'win32') {
    env.Path = env.PATH;
    env.PATHEXT = `.CMD;.EXE;.BAT;.COM;${process.env.PATHEXT ?? ''}`;
  }
  const result = spawnSync(
    typeof script === 'string' ? script : 'exit 127',
    [],
    {
      cwd,
      encoding: 'utf-8',
      env,
      shell: true,
    },
  );
  const records: CommandRecord[] = fs.existsSync(logPath)
    ? fs
        .readFileSync(logPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as CommandRecord)
    : [];
  return { records, result };
}

function recordedPnpmScripts(records: CommandRecord[]) {
  return records
    .filter(record => record.command === 'pnpm')
    .map(record =>
      record.args[0] === 'run' ? record.args[1] : record.args[0],
    );
}

function assertRecordedNodeTarget(
  record: CommandRecord | undefined,
  expectedBasename: string,
) {
  assert.ok(record, `expected node to execute ${expectedBasename}`);
  assert.equal(record.command, 'node');
  assert.equal(path.basename(record.args[0] ?? ''), expectedBasename);
  assert.equal(
    fs.existsSync(path.resolve(record.cwd, record.args[0] ?? '')),
    true,
    `${expectedBasename} must resolve to an existing executable script`,
  );
}

function assertGitIgnored(workspaceDir: string, relativePaths: string[]) {
  const initialized = spawnSync('git', ['init', '--quiet'], {
    cwd: workspaceDir,
    encoding: 'utf-8',
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(workspaceDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'ignore probe\n');
    const ignored = spawnSync(
      'git',
      ['check-ignore', '--quiet', '--', relativePath],
      { cwd: workspaceDir, encoding: 'utf-8' },
    );
    assert.equal(ignored.status, 0, `${relativePath} must be ignored by git`);
  }
}

test('migrate preserves consumer-owned check segments and rewrites migrated script refs', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-check-merge');

  try {
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });

    const before = readJson(workspaceDir, 'package.json');
    before.scripts['content:validate'] = 'node ./scripts/content-validate.mjs';
    before.scripts.check = `${before.scripts.check} && pnpm content:validate && pnpm design-system:check`;
    before.scripts['design-system:check'] =
      'node ./scripts/design-system-check.mjs';
    writeJson(workspaceDir, 'package.json', before);
    fs.writeFileSync(
      path.join(workspaceDir, 'scripts/content-validate.mjs'),
      'export {};\n',
    );
    fs.writeFileSync(
      path.join(workspaceDir, 'scripts/design-system-check.mjs'),
      'export {};\n',
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );

    const check = runRecordedPackageScript(
      tempRoot,
      workspaceDir,
      '.',
      'check',
    );
    assert.equal(check.result.status, 0, check.result.stderr);
    const invokedScripts = recordedPnpmScripts(check.records);
    const contentIndex = invokedScripts.indexOf('content:validate');
    const designSystemIndex = invokedScripts.indexOf('design-system:check');
    const performanceIndex = invokedScripts.indexOf('performance:readiness');
    assert.notEqual(contentIndex, -1);
    assert.notEqual(designSystemIndex, -1);
    assert.notEqual(performanceIndex, -1);
    assert.ok(contentIndex < designSystemIndex);
    assert.ok(designSystemIndex < performanceIndex);
    assert.equal(invokedScripts.at(-1), 'performance:readiness');
    assert.equal(invokedScripts.includes('node:proof'), false);

    const failedCheck = runRecordedPackageScript(
      tempRoot,
      workspaceDir,
      '.',
      'check',
      { failCode: 37, failInvocation: 'pnpm:content:validate' },
    );
    assert.equal(failedCheck.result.status, 37);
    const failedInvocations = recordedPnpmScripts(failedCheck.records);
    assert.equal(failedInvocations.includes('design-system:check'), false);
    assert.equal(failedInvocations.includes('performance:readiness'), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate removes the retired Module Federation TypeScript shim idempotently', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-mf-ts-shim');
  const workspacePath = path.join(workspaceDir, 'pnpm-workspace.yaml');

  try {
    const policy = yaml.load(fs.readFileSync(workspacePath, 'utf-8')) as Record<
      string,
      any
    >;
    policy.peerDependencyRules.allowedVersions[
      '@module-federation/dts-plugin>typescript'
    ] = '6.0.3';
    policy.packageExtensions = {
      '@module-federation/dts-plugin@2.7.0': {
        dependencies: { typescript: 'npm:typescript@6.0.3' },
        peerDependencies: { typescript: '6.0.3' },
      },
      'consumer-owned-package@1.2.3': {
        dependencies: { consumer: '4.5.6' },
      },
    };
    fs.writeFileSync(workspacePath, yaml.dump(policy), 'utf-8');

    for (let run = 0; run < 2; run += 1) {
      assert.equal(
        await runUltramodernToolingCli(
          ['migrate-strict-effect', '--skip-install'],
          workspaceDir,
        ),
        0,
      );
    }

    const migratedPolicy = yaml.load(
      fs.readFileSync(workspacePath, 'utf-8'),
    ) as Record<string, any>;
    assert.equal(
      migratedPolicy.peerDependencyRules.allowedVersions[
        '@module-federation/dts-plugin>typescript'
      ],
      undefined,
    );
    assert.equal(
      migratedPolicy.packageExtensions['@module-federation/dts-plugin@2.7.0'],
      undefined,
    );
    assert.deepEqual(
      migratedPolicy.packageExtensions['consumer-owned-package@1.2.3'],
      {
        dependencies: { consumer: '4.5.6' },
      },
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate preserves and rejects unknown bytes at the shared retired Effect patch path', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace(
    'tooling-modified-retired-effect-patch',
  );
  const workspacePath = path.join(workspaceDir, 'pnpm-workspace.yaml');
  const relativePatchPath = 'patches/effect-schema-error-type-id.patch';
  const patchPath = path.join(workspaceDir, relativePatchPath);
  const selector = 'effect@4.0.0-beta.94';

  try {
    const policy = yaml.load(fs.readFileSync(workspacePath, 'utf-8')) as Record<
      string,
      any
    >;
    policy.patchedDependencies[selector] = relativePatchPath;
    fs.writeFileSync(workspacePath, yaml.dump(policy), 'utf-8');
    fs.writeFileSync(patchPath, 'consumer-modified Effect patch bytes\n');
    const originalWorkspace = fs.readFileSync(workspacePath);
    const originalPatch = fs.readFileSync(patchPath);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      1,
    );
    assert.deepEqual(fs.readFileSync(workspacePath), originalWorkspace);
    assert.deepEqual(fs.readFileSync(patchPath), originalPatch);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate rejects patched dependency paths that escape the workspace', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace(
    'tooling-escaping-patch-path',
  );
  const workspacePath = path.join(workspaceDir, 'pnpm-workspace.yaml');
  const patchFile = '@react-server-dom-rspack@0.0.3.patch';
  const relativePatchPath = `patches/${patchFile}`;
  const patchPath = path.join(workspaceDir, relativePatchPath);

  try {
    const policy = yaml.load(fs.readFileSync(workspacePath, 'utf-8')) as Record<
      string,
      any
    >;
    policy.patchedDependencies['react-server-dom-rspack@0.0.3'] =
      relativePatchPath;
    policy.patchedDependencies['consumer-package@1.0.0'] =
      '../outside-workspace.patch';
    fs.writeFileSync(workspacePath, yaml.dump(policy), 'utf-8');
    writeRetiredRspackRscPatch(workspaceDir, relativePatchPath);
    const originalWorkspace = fs.readFileSync(workspacePath);
    const originalPatch = fs.readFileSync(patchPath);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      1,
    );
    assert.deepEqual(fs.readFileSync(workspacePath), originalWorkspace);
    assert.deepEqual(fs.readFileSync(patchPath), originalPatch);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate materializes every validator-required wrapper and rewires legacy scripts', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace(
    'tooling-legacy-scripts',
  );

  try {
    const legacyRenames = [
      'bootstrap-agent-skills',
      'setup-agent-reference-repos',
      'check-ultramodern-i18n-boundaries',
    ];
    for (const name of legacyRenames) {
      fs.renameSync(
        path.join(workspaceDir, `scripts/${name}.mts`),
        path.join(workspaceDir, `scripts/${name}.mjs`),
      );
    }
    const before = readJson(workspaceDir, 'package.json');
    before.scripts['skills:install'] =
      'node ./scripts/bootstrap-agent-skills.mjs';
    before.scripts['skills:check'] =
      'node ./scripts/bootstrap-agent-skills.mjs --check';
    before.scripts.postinstall =
      "oxfmt . '!repos/**' && node ./scripts/bootstrap-agent-skills.mjs --postinstall";
    before.scripts.format = "oxfmt . '!repos/**'";
    before.scripts['format:check'] = "oxfmt --check . '!repos/**'";
    before.scripts['agents:refs:install'] =
      'node ./scripts/setup-agent-reference-repos.mjs';
    before.scripts['i18n:boundaries'] =
      'node ./scripts/check-ultramodern-i18n-boundaries.mjs';
    writeJson(workspaceDir, 'package.json', before);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );

    for (const name of legacyRenames) {
      assert.equal(exists(workspaceDir, `scripts/${name}.mts`), true, name);
      assert.equal(exists(workspaceDir, `scripts/${name}.mjs`), false, name);
    }
    const expectations = [
      ['skills:install', 'bootstrap-agent-skills.mts', []],
      ['skills:check', 'bootstrap-agent-skills.mts', ['--check']],
      ['postinstall', 'bootstrap-agent-skills.mts', ['--postinstall']],
    ] as const;
    for (const [scriptName, target, expectedArgs] of expectations) {
      const execution = runRecordedPackageScript(
        tempRoot,
        workspaceDir,
        '.',
        scriptName,
      );
      assert.equal(execution.result.status, 0, execution.result.stderr);
      const nodeRecord = execution.records.find(
        record => record.command === 'node',
      );
      assertRecordedNodeTarget(nodeRecord, target);
      assert.deepEqual(nodeRecord?.args.slice(1), expectedArgs);
      if (scriptName === 'postinstall') {
        assert.deepEqual(
          execution.records.map(record => record.command),
          ['node'],
        );
      }
    }
    const after = readJson(workspaceDir, 'package.json');
    assert.equal(after.scripts.format, 'oxfmt .');
    assert.equal(after.scripts['format:check'], 'oxfmt --check .');
    assert.equal(
      after.scripts.postinstall,
      'node ./scripts/bootstrap-agent-skills.mts --postinstall',
    );
    for (const [scriptName, expectedArgs] of [['format', ['.']]] as const) {
      const execution = runRecordedPackageScript(
        tempRoot,
        workspaceDir,
        '.',
        scriptName,
      );
      assert.equal(execution.result.status, 0, execution.result.stderr);
      assert.equal(execution.records.length, 1);
      assert.equal(execution.records[0]?.command, 'oxfmt');
      assert.deepEqual(execution.records[0]?.args, expectedArgs);
      assert.equal(
        fs.realpathSync(execution.records[0]!.cwd),
        fs.realpathSync(workspaceDir),
      );
      assert.deepEqual(execution.records[0]?.env, {});
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

function fileMutationStamp(filePath: string) {
  const stat = fs.statSync(filePath);
  return {
    mode: stat.mode,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  };
}

type WorkspaceByteSnapshot = Record<
  string,
  | { mode: number; type: 'directory' }
  | { bytes: string; mode: number; type: 'file' }
  | { mode: number; target: string; type: 'symlink' }
>;

function snapshotWorkspaceBytes(root: string): WorkspaceByteSnapshot {
  const tree: WorkspaceByteSnapshot = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      const mode = stat.mode & 0o7777;
      if (entry.isDirectory()) {
        tree[relative] = { mode, type: 'directory' };
        walk(absolute);
      } else if (entry.isFile()) {
        tree[relative] = {
          bytes: fs.readFileSync(absolute).toString('base64'),
          mode,
          type: 'file',
        };
      } else if (entry.isSymbolicLink()) {
        tree[relative] = {
          mode,
          target: fs.readlinkSync(absolute),
          type: 'symlink',
        };
      } else {
        throw new Error(`Unsupported workspace entry in test: ${absolute}`);
      }
    }
  };
  walk(root);
  return tree;
}

async function loadOxfmtConfig(workspaceDir: string, revision: string) {
  const workspaceNodeModules = path.join(workspaceDir, 'node_modules');
  if (!fs.existsSync(workspaceNodeModules)) {
    fs.symlinkSync(
      path.resolve(__dirname, '../../../..', 'node_modules'),
      workspaceNodeModules,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  return (
    await import(
      `${pathToFileURL(path.join(workspaceDir, 'oxfmt.config.ts')).href}?revision=${revision}`
    )
  ).default as { ignorePatterns?: string[] };
}

function captureStdout<T>(run: () => T): { result: T; output: string } {
  const original = process.stdout.write.bind(process.stdout);
  let output = '';
  (process.stdout as NodeJS.WriteStream).write = ((chunk: unknown) => {
    output += typeof chunk === 'string' ? chunk : String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    const result = run();
    return { result, output };
  } finally {
    process.stdout.write = original;
  }
}

test('UltraModern migrate preserves a dist-named vertical across dry-run and apply', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace(
    'tooling-dry-run-dist-vertical',
  );

  try {
    const verticalPackagePath = 'verticals/dist/package.json';
    fs.mkdirSync(path.dirname(path.join(workspaceDir, verticalPackagePath)), {
      recursive: true,
    });
    writeJson(workspaceDir, verticalPackagePath, {
      name: '@tooling-dry-run-dist-vertical/dist',
      version: '0.1.0',
      private: true,
      dependencies: {
        '@modern-js/runtime': '0.0.0',
      },
    });
    const before = snapshotWorkspaceBytes(workspaceDir);

    const { result, output } = captureStdout(() =>
      runUltramodernToolingCli(
        ['migrate-strict-effect', '--dry-run'],
        workspaceDir,
      ),
    );
    assert.equal(await result, 0);
    assert.deepEqual(snapshotWorkspaceBytes(workspaceDir), before);
    assert.match(
      output,
      /\[dry-run\] would write verticals\/dist\/package\.json/u,
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );
    assert.equal(
      readJson(workspaceDir, verticalPackagePath).dependencies[
        '@modern-js/runtime'
      ],
      'workspace:*',
    );
    const afterApply = snapshotWorkspaceBytes(workspaceDir);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );
    assert.deepEqual(snapshotWorkspaceBytes(workspaceDir), afterApply);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('UltraModern migrate ignores generated build output', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-gitignore');

  try {
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );
    assertGitIgnored(workspaceDir, [
      '.output/server/index.js',
      '.modern-js/build.json',
      'verticals/catalog/src/modern-tanstack/router.gen.ts',
    ]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('UltraModern migrate rejects duplicate pnpm mappings without writes', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-yaml-dedupe');

  try {
    const pnpmWorkspaceFile = path.join(workspaceDir, 'pnpm-workspace.yaml');
    const unquotedLine = `  @module-federation/runtime-core@${MODULE_FEDERATION_VERSION}: patches/@module-federation__runtime-core@${MODULE_FEDERATION_VERSION}.patch`;
    fs.writeFileSync(
      pnpmWorkspaceFile,
      fs
        .readFileSync(pnpmWorkspaceFile, 'utf-8')
        .replace(
          `  '@module-federation/runtime-core@${MODULE_FEDERATION_VERSION}': patches/@module-federation__runtime-core@${MODULE_FEDERATION_VERSION}.patch`,
          `${unquotedLine}\n${unquotedLine}`,
        ),
      'utf-8',
    );
    const rootPackageFile = path.join(workspaceDir, 'package.json');
    const duplicatePolicyStamp = fileMutationStamp(pnpmWorkspaceFile);
    const rootPackageStamp = fileMutationStamp(rootPackageFile);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      1,
    );

    assert.deepEqual(
      fileMutationStamp(pnpmWorkspaceFile),
      duplicatePolicyStamp,
    );
    assert.deepEqual(fileMutationStamp(rootPackageFile), rootPackageStamp);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('UltraModern migrate syncs oxfmt ignorePatterns and tolerates unparseable configs', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-oxfmt');

  try {
    const oxfmtPath = path.join(workspaceDir, 'oxfmt.config.ts');
    fs.writeFileSync(
      oxfmtPath,
      `import { defineConfig } from 'oxfmt';

export default defineConfig({
  ignorePatterns: [
    '.modernjs',
    '**/modern-tanstack/**',
  ],
  singleQuote: true,
});
`,
      'utf-8',
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );

    const patched = await loadOxfmtConfig(workspaceDir, 'first');
    assert.deepEqual(patched.ignorePatterns, [
      '.modernjs',
      '**/modern-tanstack/**',
      '.output',
      'repos/**',
      '**/routeTree.gen.*',
    ]);

    fs.writeFileSync(
      path.join(workspaceDir, 'extra-ignores.ts'),
      `export default ${JSON.stringify(patched.ignorePatterns)};\n`,
      'utf-8',
    );
    const unparseable = `import { defineConfig } from 'oxfmt';
import extra from './extra-ignores.ts';

export default defineConfig({
  ignorePatterns: [...extra],
  singleQuote: true,
});
`;
    fs.writeFileSync(oxfmtPath, unparseable, 'utf-8');
    const unparseableStamp = fileMutationStamp(oxfmtPath);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      0,
    );
    assert.deepEqual(fileMutationStamp(oxfmtPath), unparseableStamp);

    const rootPackage = readJson(workspaceDir, 'package.json');
    rootPackage.scripts.postinstall =
      "oxfmt . '!repos/**' && node ./scripts/bootstrap-agent-skills.mts --postinstall";
    rootPackage.scripts.format = "oxfmt . '!repos/**'";
    rootPackage.scripts['format:check'] = "oxfmt --check . '!repos/**'";
    writeJson(workspaceDir, 'package.json', rootPackage);
    const legacyRootStamp = fileMutationStamp(
      path.join(workspaceDir, 'package.json'),
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceDir,
      ),
      1,
    );
    assert.deepEqual(
      fileMutationStamp(path.join(workspaceDir, 'package.json')),
      legacyRootStamp,
    );
    assert.deepEqual(fileMutationStamp(oxfmtPath), unparseableStamp);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
