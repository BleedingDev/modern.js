// Consumers: independent ERP-10 and Tractor registry convergence gates.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const script = path.resolve(__dirname, '../wait-for-registry-cohort.sh');

test('registry wait fails closed when the cohort never becomes verifiable', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cohort-wait-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({
      release: { version: '3.8.2-ultramodern.9', tag: 'latest' },
    }),
  );
  fs.writeFileSync(
    path.join(root, 'node'),
    `#!${process.execPath}
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
if (args[0] === '-e') {
  process.exit(spawnSync(process.execPath, args, { stdio: 'inherit' }).status);
}
process.exit(1);
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(root, 'sleep'), '#!/bin/sh\nexit 0\n', {
    mode: 0o755,
  });
  const result = spawnSync('bash', [script, root, '8'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${root}${path.delimiter}${process.env.PATH}`,
    },
  });
  assert.equal(result.status, 1);
});
