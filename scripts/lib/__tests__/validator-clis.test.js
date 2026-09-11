/**
 * End-to-end exit-code contracts for the gate validator CLIs that share
 * scripts/lib/validation-kit.js. Broken input must exit 1 with the
 * validator's failure prefix on stderr.
 */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'validator-cli-'));

const runCli = (cliPath, args) =>
  spawnSync(process.execPath, [path.join(repoRoot, cliPath), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

const writeJson = (dir, name, value) => {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
};

test('boundary-guards CLI fails on an unsupported profile schemaVersion', () => {
  const dir = makeTempDir();
  try {
    const profilePath = writeJson(dir, 'profile.json', {
      schemaVersion: 2,
      importGuards: [],
    });
    const result = runCli('scripts/boundary-guards/check-boundary-violations.js', [
      '--profile',
      profilePath,
      '--allow-empty-manifests',
    ]);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Unsupported boundary guard profile schemaVersion: 2/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
