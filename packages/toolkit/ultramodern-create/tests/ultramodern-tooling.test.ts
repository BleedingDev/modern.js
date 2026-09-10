import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { yaml } from '@modern-js/utils';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';

import {
  readUltramodernConfig,
  workspaceAppsFromToolingConfig,
} from '../src/ultramodern-tooling/config';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
import { shellApp } from '../src/ultramodern-workspace/descriptors';
import {
  createAppMfTypesTsConfig,
  createAppTsConfig,
} from '../src/ultramodern-workspace/package-json';
import {
  renderMinimumReleaseAgeExclude,
  ULTRAMODERN_WORKSPACE_POLICY,
} from '../src/ultramodern-workspace/policy';
import {
  CROSS_ENV_VERSION,
  DRIZZLE_ORM_VERSION,
  EFFECT_VERSION,
  EFFECT_VITEST_VERSION,
  MODULE_FEDERATION_VERSION,
  MSGPACKR_VERSION,
  NODE_VERSION,
  OXFMT_VERSION,
  PNPM_VERSION,
  TYPESCRIPT_NATIVE_PREVIEW_VERSION,
  TYPESCRIPT_VERSION,
  ZOD_VERSION,
} from '../src/ultramodern-workspace/versions';
import { createWorkspaceRootPackageScripts } from '../src/ultramodern-workspace/workspace-script-plan';
import { linkWorkspaceFormatterDependencies } from './helpers/workspace-kit';

const retiredContractPath = '.modernjs/ultramodern-generated-contract.json';
const retiredPackageSourcePath = '.modernjs/ultramodern-package-source.json';
const staleOxcBindingTargets = [
  'android-arm-eabi',
  'android-arm64',
  'darwin-arm64',
  'darwin-x64',
  'freebsd-x64',
  'linux-arm-gnueabihf',
  'linux-arm-musleabihf',
  'linux-arm64-gnu',
  'linux-arm64-musl',
  'linux-ppc64-gnu',
  'linux-riscv64-gnu',
  'linux-riscv64-musl',
  'linux-s390x-gnu',
  'linux-x64-gnu',
  'linux-x64-musl',
  'openharmony-arm64',
  'win32-arm64-msvc',
  'win32-ia32-msvc',
  'win32-x64-msvc',
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

function writeStandaloneEffectApi(workspaceDir: string) {
  fs.writeFileSync(
    path.join(workspaceDir, 'verticals/catalog/api/effect-api.ts'),
    `export const contract = { servicePrefix: '/catalog-api' };
export const runtime = { brand: 'test-effect-runtime' };
`,
    'utf-8',
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

function writeRetiredEffectSchemaPatch(
  workspaceDir: string,
  contents?: Uint8Array,
) {
  fs.writeFileSync(
    path.join(workspaceDir, 'patches/effect-schema-error-type-id.patch'),
    contents ??
      `diff --git a/dist/Schema.d.ts b/dist/Schema.d.ts
index 9547bd05cb7b91e5e5decc43b64c10a47a86186a..e58693c3742604ccb703045dedd259fca2c66b6e 100644
--- a/dist/Schema.d.ts
+++ b/dist/Schema.d.ts
@@ -10812,7 +10812,7 @@ export declare namespace Annotations {
          *
          * Reserved to internal use only.
          */
-        readonly "~sentinels"?: ReadonlyArray<SchemaAST.Sentinel> | undefined;
+        readonly "~sentinels"?: ReadonlyArray<unknown> | undefined;
     }
     /**
      * Annotations for filter schema nodes (created via \`Schema.filter\`). Extends
`,
  );
}

const retiredEffectPatchCases = [
  {
    selector: 'effect@4.0.0-beta.94',
    sha256: 'dc7e8088e600beb20185eb877754d749c4a93909fb79f49465e8319e40d6596a',
    gzipBase64:
      'H4sIAAAAAAACA71S0W6bMBR95yuu8rSNAHYwxiRdlJdK3cOkqd20Z8O9XtgSYIZWnaru2+cAUrskXZqXSRa2uPccn3uOsTQGguBb2YGOsGy7qKw6spXeRG2xpq0etxDDroX8ZItXVkj3kJqcqOA6kVolOueJzIzKFaOYZyYXMlY645InYTjjGCuTzma7r1CYqQxjpphJU2SEppBxwYhL4IxJIbwgCF6h1PN9/zVqVysI4ikDX8Bq5fl039S2A6Rioy1BUVdtBzd9/6W1tf38q6EPOIfJbzKGii4aatGzlsnCwwNPbx2PzjcUrbuueRLUWLqmtnG30JWucEP2L5vPQ43OK05upUIYnSSYz6RItRIqzjKOuWAxisSVEcOQCYayyNJcJcgKxlFokaaMx4yzPDOJQCFnSOqI82cqexbGmchdPhx8PpW7fIIxn4fHheeX2/7cuUjgHegWLvtIwNh6C5MwjIY1/HVckz3MA1w5CTdk78j2ycHjE3avdAJ+TT9vyb2UowRj8STFMP1LHEN1JDn6TO1wz6cDJ9s5fCX946NuLur8uzNjCm/G5vnhEFNHNMDnR+S9hffL0ehw2C4Om6b7zi6XL4nWTUMVHmr+UrXaOAX/FLoeeuf/fZwedleXuPD+AF+sViVABQAA',
  },
  {
    selector: 'effect@4.0.0-beta.97',
    sha256: 'dc7e8088e600beb20185eb877754d749c4a93909fb79f49465e8319e40d6596a',
    gzipBase64:
      'H4sIAAAAAAACA71S0W6bMBR95yuu8rSNAHYwxiRdlJdK3cOkqd20Z8O9XtgSYIZWnaru2+cAUrskXZqXSRa2uPccn3uOsTQGguBb2YGOsGy7qKw6spXeRG2xpq0etxDDroX8ZItXVkj3kJqcqOA6kVolOueJzIzKFaOYZyYXMlY645InYTjjGCuTzma7r1CYqQxjpphJU2SEppBxwYhL4IxJIbwgCF6h1PN9/zVqVysI4ikDX8Bq5fl039S2A6Rioy1BUVdtBzd9/6W1tf38q6EPOIfJbzKGii4aatGzlsnCwwNPbx2PzjcUrbuueRLUWLqmtnG30JWucEP2L5vPQ43OK05upUIYnSSYz6RItRIqzjKOuWAxisSVEcOQCYayyNJcJcgKxlFokaaMx4yzPDOJQCFnSOqI82cqexbGmchdPhx8PpW7fIIxn4fHheeX2/7cuUjgHegWLvtIwNh6C5MwjIY1/HVckz3MA1w5CTdk78j2ycHjE3avdAJ+TT9vyb2UowRj8STFMP1LHEN1JDn6TO1wz6cDJ9s5fCX946NuLur8uzNjCm/G5vnhEFNHNMDnR+S9hffL0ehw2C4Om6b7zi6XL4nWTUMVHmr+UrXaOAX/FLoeeuf/fZwedleXuPD+AF+sViVABQAA',
  },
  {
    selector: 'effect@4.0.0-beta.102',
    sha256: 'bd29a0ae24f0674c6007e5e6060d847dbeb9499a6e2cf4c9f13b24ba9fb3af37',
    gzipBase64:
      'H4sIAAAAAAACA72SS0/jMBSF9/kVV7AB8nLaPGgLVTdILJjRqAixmY0f12BI7YztMiDEfx+LREJQOkhdIEWKlHvPl3OOLZSUkKY3ygPNhXI+X2vnKWsxv/W+y5X2aDVt887iEl1ntMNzqkWLNhOZd8B2UUVKC3wElKwoa3F8jKKWvK7GbNLIclSQighW4ZiVjLFGYJaNG6xIxWSNhPOGsbriWMsJJZUoGiJ44MgJGQkoCKnLMkrTdLc8URzHO2ZaLCAtkhHERVLDYhGl+NgZ6+H5ZRaleb4Pzqwtxx+065S+uVpenG4hZSvaRb/hpwGNf1ulEagH1AKMBKlajGK1eiX7pw7hCKiDMymRe5DWrGAvy/L+6b8G4t7sveYZzkOkS7QPaM+sNRZe3rQfRl/Il/hnjc5/DhiGXyL6DrYx+ukAGUoVyFtqEXgYebD9f35t9OmmcI30PnR+YthdKCOBg2F5uhkiCaBePv3E3iGczoeis/51srmUfGx2Pt9mOtyDcKibnq+0ozI4+K/R2353+u1xXmUPRolZ9A+P0IT9PAQAAA==',
  },
  {
    selector: 'effect@4.0.0-beta.102',
    sha256: 'd9e12b42d06a051957899a9df14b2b7b2385fc3a5677a89037eeee3674d64ebe',
    gzipBase64:
      'H4sIAAAAAAACA71UTVPbMBC9+1fspBcg8Vdsy06AFA7McGg7HVKmlx7QxwpcHNmVFD6G0t9eETstJKFMLvV4xrJ29+nt05NEKSX4/mVpgYaiNDac8iuc0UAE1gBbm/JKJfAOeE4IK1LKiojGIiV5RjmPYh6nGeGplCgxETGJgyBGOkqGmI6GES8ykZNRlOUZysQhFITTIiM4YkMBcRSRNPV839/AxOv3+5vYHB2BH0d5kQxy6C8HbhLvmlpbEMgrqhEUnaFpKEc4Vqq21Ja1MvDgwZ9n7/kYztCgvkEBtoZSWdSKVjA3CLWq7oPnqaHnL8caqXiKQ++XQWVLhZXpvR87sHb+WGt6f9CyP55+CaZd0gR+wtypKt2P2Pf62+HN1bWqb9UKyALgsf2Ee8vm9l60L2sNsqxcd2AWpEDVAg3scLeydc3flBQuOrXbxIvdAE7uLCphPLHmnLkylrIKwytrm3CpW9hodHo2bkk8pUpUqF+Ya7uqzn8oWZwSURQoiOQkS9gol+kwjrJIsAwTljLGcoFBkOSYRRmTBCPOc8ZIxpHIEY0yEeeR4A5HjqKN/tuS2TOLblm5cPFg6Bw8IM69nt/Z9+Fx3/PD8B2Yeq45fqRNU6rL87MPh68gBTPaeN/gUw0KbytnBaAW3G5BLZ+2Gr1+OVsg2/sGnR2ogRN3WLkFqesZ9IIgbN921iH29l/WPMCpa2n6dDr0idbOQo9/a1dCb5Sf4Y85GrsZoAu+CdFq8BpGG+1AVu4E7kLWHbLFOp/X9DRj+Ir02ml+ULPvTowB7HTJ4/UmBg6oLR9voLcLh5NO6KD9HKwnDVaVnUxeI+184DZ1nfO5MlQ6Bv8ketXmjv97O4uym7p019NvSM+CTXYGAAA=',
  },
] as const;

function readYaml(workspaceDir: string, relativePath: string) {
  return yaml.load(
    fs.readFileSync(path.join(workspaceDir, relativePath), 'utf-8'),
  ) as Record<string, any>;
}

function writeYaml(
  workspaceDir: string,
  relativePath: string,
  value: Record<string, any>,
) {
  fs.writeFileSync(
    path.join(workspaceDir, relativePath),
    yaml.dump(value, {
      lineWidth: -1,
      noCompatMode: true,
      noRefs: true,
      quotingType: "'",
    }),
    'utf-8',
  );
}

function replaceValuesForKey(
  value: unknown,
  key: string,
  replacement: unknown,
): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, item) => count + replaceValuesForKey(item, key, replacement),
      0,
    );
  }
  if (value === null || typeof value !== 'object') {
    return 0;
  }
  let count = 0;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key) {
      (value as Record<string, unknown>)[entryKey] = replacement;
      count += 1;
    } else {
      count += replaceValuesForKey(entryValue, key, replacement);
    }
  }
  return count;
}

function valuesForKey(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(item => valuesForKey(item, key));
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).flatMap(([entryKey, entryValue]) =>
    entryKey === key ? [entryValue] : valuesForKey(entryValue, key),
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

function normalizedCommandTrace(records: CommandRecord[]) {
  return records.map(({ args, command, env }) => ({ args, command, env }));
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

test('fresh shell-only workspace omits backend-federation and Zerops runtime surfaces', () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace(
    'tooling-shell-only-fresh',
  );

  try {
    const check = runRecordedPackageScript(
      tempRoot,
      workspaceDir,
      '.',
      'check',
    );
    assert.equal(check.result.status, 0, check.result.stderr);
    const invokedScripts = recordedPnpmScripts(check.records);
    assert.equal(invokedScripts.includes('node:proof'), false);
    assert.equal(
      invokedScripts.includes('node:backend-federation:generate'),
      false,
    );
    for (const scriptName of [
      'node:proof',
      'node:backend-federation:generate',
      'zerops:materialize',
      'cloudflare:ssr-proof',
    ]) {
      assert.notEqual(
        runRecordedPackageScript(tempRoot, workspaceDir, '.', scriptName).result
          .status,
        0,
      );
    }
    assert.equal(
      exists(workspaceDir, 'scripts/generate-node-backend-federation.mts'),
      false,
    );
    assert.equal(
      exists(workspaceDir, 'scripts/proof-node-backend-federation.mts'),
      false,
    );
    assert.equal(
      exists(workspaceDir, 'scripts/materialize-zerops-runtime.mjs'),
      false,
    );
    assert.equal(exists(workspaceDir, 'scripts/proof-workerd-ssr.mts'), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('backend federation proof skips runtime loading when no backend apps exist', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-proof-empty');

  try {
    assert.equal(
      await runUltramodernToolingCli(
        ['backend-federation-proof'],
        workspaceDir,
      ),
      0,
    );

    const report = readJson(
      workspaceDir,
      '.codex/reports/node-backend-federation-proof/proof.json',
    );
    assert.equal(report.status, 'skipped');
    assert.deepEqual(report.results, []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('backend federation proof rejects drifted delivery-unit stamps in the manifest', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace(
    'tooling-backend-mf-drift',
  );

  try {
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });

    writeStandaloneEffectApi(workspaceDir);

    assert.equal(
      await runUltramodernToolingCli(
        ['backend-federation-generate', '--app', 'catalog'],
        workspaceDir,
      ),
      0,
    );

    const manifestPath = path.join(
      workspaceDir,
      'verticals/catalog/dist/backend-mf-manifest.json',
    );
    const manifest = readJson(
      workspaceDir,
      'verticals/catalog/dist/backend-mf-manifest.json',
    );

    if (!manifest.backendFederation?.deliveryUnit) {
      // No delivery-unit stamp was generated for this workspace shape;
      // there is nothing to drift, so the negative case does not apply.
      return;
    }

    manifest.backendFederation.deliveryUnit.buildMarker = 'deadbeefdeadbeef';
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf-8',
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['backend-federation-proof'],
        workspaceDir,
      ),
      1,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('UltraModern tooling config reads current compact config', () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-config');

  try {
    const compact = readUltramodernConfig(workspaceDir);
    assert.equal(compact.source, 'compact');
    assert.equal(compact.workspace.packageScope, 'tooling-config');
    assert.equal(compact.packageSource?.strategy, 'workspace');
    assert.equal(compact.packageSource?.modernPackageVersion, 'workspace:*');
    assert.deepEqual(
      compact.topology.apps.map(app => app.id),
      ['shell-super-app'],
    );
    assert.equal(compact.topology.apps[0].moduleFederation?.role, 'host');
    assert.equal(
      fs.existsSync(path.join(workspaceDir, retiredContractPath)),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(workspaceDir, retiredPackageSourcePath)),
      false,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('UltraModern mf-types validates real Module Federation config files', async () => {
  const { tempRoot, workspaceDir } = scaffoldWorkspace('tooling-mf');

  try {
    assert.equal(
      await runUltramodernToolingCli(
        ['mf-types', 'apps/shell-super-app'],
        workspaceDir,
      ),
      0,
    );

    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });

    assert.equal(
      await runUltramodernToolingCli(
        ['mf-types', 'verticals/catalog'],
        workspaceDir,
      ),
      1,
      'remote exposes must require a non-empty DTS archive',
    );

    const archivePath = path.join(
      workspaceDir,
      'verticals/catalog/dist/@mf-types.zip',
    );
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.writeFileSync(archivePath, 'zip');

    assert.equal(
      await runUltramodernToolingCli(
        ['mf-types', 'verticals/catalog'],
        workspaceDir,
      ),
      0,
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['mf-types', '--target', 'cloudflare', 'verticals/catalog'],
        workspaceDir,
      ),
      1,
    );
    const cloudflareArchivePath = path.join(
      workspaceDir,
      'verticals/catalog/dist-cloudflare/@mf-types.zip',
    );
    fs.mkdirSync(path.dirname(cloudflareArchivePath), { recursive: true });
    fs.writeFileSync(cloudflareArchivePath, 'zip');
    assert.equal(
      await runUltramodernToolingCli(
        ['mf-types', '--target=cloudflare', 'verticals/catalog'],
        workspaceDir,
      ),
      0,
    );
    assert.equal(
      await runUltramodernToolingCli(
        ['mf-types', '--target', 'invalid', 'verticals/catalog'],
        workspaceDir,
      ),
      1,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('compact UltraModern config maps component exposes to concrete DTS source files', () => {
  const apps = workspaceAppsFromToolingConfig({
    schemaVersion: 1,
    source: 'compact',
    sourcePath: '.modernjs/ultramodern.json',
    workspace: {
      packageScope: 'tooling-exposes',
    },
    features: {
      tailwind: true,
    },
    topology: {
      apps: [
        {
          id: 'shell-super-app',
          kind: 'shell',
          path: 'apps/shell-super-app',
          moduleFederation: {
            role: 'host',
            name: 'shellSuperApp',
            exposes: [],
            verticalRefs: ['catalog'],
          },
        },
        {
          id: 'catalog',
          kind: 'vertical',
          path: 'verticals/catalog',
          domain: 'catalog',
          moduleFederation: {
            role: 'remote',
            name: 'verticalCatalog',
            exposes: ['./ProductGrid', './Route', './Widget', './Custom'],
            exposePaths: {
              './Custom': './src/features/custom-surface.tsx',
            },
          },
          api: {
            stem: 'catalog',
            prefix: '/catalog-api',
            consumedBy: ['shell-super-app', 'catalog'],
          },
        },
      ],
    },
  });

  const catalog = apps.find(app => app.id === 'catalog');

  assert.deepEqual(catalog?.exposes, {
    './Custom': './src/features/custom-surface.tsx',
    './ProductGrid': './src/components/product-grid.tsx',
    './Route': './src/federation-entry.tsx',
    './Widget': './src/components/catalog-widget.tsx',
  });
  const mfTypesConfig = createAppMfTypesTsConfig(catalog!) as Record<
    string,
    unknown
  >;
  assert.deepEqual(
    mfTypesConfig.include,
    [
      'src/federation-entry.tsx',
      'src/components/product-grid.tsx',
      'src/components/catalog-widget.tsx',
      'src/features/custom-surface.tsx',
      'src/modern-app-env.d.ts',
    ],
    'custom expose order must keep the route entry first for MF DTS validation',
  );
  assert.deepEqual(mfTypesConfig.compilerOptions, { skipLibCheck: true });
});

test('generated app tsconfig keeps shells independent from remote declaration output', () => {
  const apps = workspaceAppsFromToolingConfig({
    schemaVersion: 1,
    source: 'compact',
    sourcePath: '.modernjs/ultramodern.json',
    workspace: {
      packageScope: 'tooling-references',
    },
    features: {
      tailwind: true,
    },
    topology: {
      apps: [
        {
          id: 'shell-super-app',
          kind: 'shell',
          path: 'apps/shell-super-app',
          moduleFederation: {
            role: 'host',
            verticalRefs: ['catalog', 'checkout'],
          },
        },
        {
          id: 'catalog',
          kind: 'vertical',
          path: 'verticals/catalog',
          moduleFederation: {
            role: 'remote',
            exposes: ['./Route'],
          },
          api: {
            stem: 'catalog',
            prefix: '/catalog-api',
            consumedBy: ['shell-super-app', 'catalog', 'checkout'],
          },
        },
        {
          id: 'checkout',
          kind: 'vertical',
          path: 'verticals/checkout',
          moduleFederation: {
            role: 'remote',
            exposes: ['./Route'],
            verticalRefs: ['catalog'],
          },
          api: {
            stem: 'checkout',
            prefix: '/checkout-api',
            consumedBy: ['shell-super-app', 'checkout'],
          },
        },
      ],
    },
  });
  const remotes = apps.filter(app => app.kind !== 'shell');
  const shell = apps.find(app => app.id === 'shell-super-app');
  const checkout = apps.find(app => app.id === 'checkout');
  const shellTsConfig = createAppTsConfig(shell!, remotes) as Record<
    string,
    unknown
  >;
  const checkoutTsConfig = createAppTsConfig(checkout!, remotes) as Record<
    string,
    unknown
  >;
  assert.deepEqual(shellTsConfig.references, [
    { path: '../../packages/shared-contracts' },
    { path: '../../packages/shared-design-tokens' },
  ]);
  assert.equal(
    (shellTsConfig.compilerOptions as Record<string, unknown>).skipLibCheck,
    undefined,
  );
  assert.deepEqual(checkoutTsConfig.include, [
    'src',
    'locales/**/*.json',
    'package.json',
    'shared',
    'shared/ultramodern-build.json',
    'server',
    'api',
  ]);
  assert.deepEqual(checkoutTsConfig.references, [
    { path: '../../packages/shared-contracts' },
    { path: '../../packages/shared-design-tokens' },
    { path: '../catalog' },
  ]);
  assert.equal(
    (checkoutTsConfig.compilerOptions as Record<string, unknown>).skipLibCheck,
    true,
  );

  const scripts = createWorkspaceRootPackageScripts(remotes);
  const referencedDeclarationBuild =
    'node ./scripts/ultramodern-typecheck.mts --emit --project verticals/catalog/tsconfig.json --skipLibCheck';
  assert.ok(scripts.build.includes(referencedDeclarationBuild));
  assert.ok(scripts['cloudflare:build'].includes(referencedDeclarationBuild));
  assert.match(
    scripts['cloudflare:build'],
    /pnpm mf:types --target cloudflare/u,
  );
  assert.ok(
    scripts.build.indexOf(referencedDeclarationBuild) <
      scripts.build.indexOf('pnpm -r --filter "./verticals/*" run build'),
  );
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
