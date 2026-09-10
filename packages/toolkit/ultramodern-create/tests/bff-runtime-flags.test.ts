import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const packageRoot = path.resolve(__dirname, '..');
const builtCliPath = path.join(packageRoot, 'dist/esm-node/index.js');

// Keeps every spawned CLI hermetic: no test may dial the npm registry for
// the @bleedingdev/modern-js-create framework cohort.
const hermeticEnv = {
  ...process.env,
  MODERN_CREATE_ULTRAMODERN_FRAMEWORK_VERSION: '3.2.0-ultramodern.108',
};

const runCli = (cwd: string, args: string[]) =>
  spawnSync(process.execPath, [builtCliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: hermeticEnv,
  });

const withTempDir = (fn: (tmpDir: string) => void) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modern-create-bff-'));
  try {
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

test('--bff keeps the default strict Effect approach workspace scaffold', () => {
  withTempDir(tmpDir => {
    const createResult = runCli(tmpDir, ['bff-default-smoke', '--bff']);
    assert.equal(createResult.status, 0, createResult.stderr);

    const workspaceDir = path.join(tmpDir, 'bff-default-smoke');
    const verticalResult = runCli(workspaceDir, ['catalog', '--vertical']);
    assert.equal(verticalResult.status, 0, verticalResult.stderr);

    const workspaceContract = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDir, '.modernjs/ultramodern.json'),
        'utf8',
      ),
    );
    const catalog = workspaceContract.topology.apps.find(
      (app: { id?: string }) => app.id === 'catalog',
    );
    assert.equal(catalog.api.runtime, 'effect');
    assert.equal(
      fs.existsSync(path.join(workspaceDir, 'verticals/catalog/api/index.ts')),
      true,
    );
  });
});

const invalidRuntimeFlagCases = [
  {
    name: 'rejects an unsupported runtime',
    project: 'bff-invalid-smoke',
    args: ['--bff-runtime', 'unknown-runtime'],
    error: /Unsupported BFF runtime "unknown-runtime"/u,
  },
  {
    name: 'requires a runtime value',
    project: 'bff-missing-smoke',
    args: ['--bff-runtime'],
    error: /--bff-runtime requires a value \(supported: effect\)/u,
  },
  {
    name: 'rejects a value for the boolean BFF flag',
    project: 'bff-value-smoke',
    args: ['--bff=hono'],
    error: /--bff does not accept a value/u,
  },
] as const;

test.each(invalidRuntimeFlagCases)('$name before writing anything', entry => {
  withTempDir(tmpDir => {
    const result = runCli(tmpDir, [entry.project, ...entry.args]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, entry.error);
    if (entry.name === 'rejects an unsupported runtime') {
      assert.match(result.stderr, /supported: effect/u);
    }
    assert.equal(
      fs.existsSync(path.join(tmpDir, entry.project)),
      false,
      'invalid flags must not leave a project directory behind',
    );
  });
});
