// Consumers: independent ERP-10 and Tractor registry convergence gates.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const script = path.resolve(__dirname, '../wait-for-registry-cohort.sh');

function runWait(t, { failures, explicit = true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cohort-wait-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const callsPath = path.join(root, 'calls.jsonl');
  const sleepsPath = path.join(root, 'sleeps');
  const manifestVersion = '3.8.2-ultramodern.9';
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({ release: { version: manifestVersion, tag: 'latest' } }),
  );
  fs.writeFileSync(
    path.join(root, 'node'),
    `#!${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
if (args[0] === '-e') {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  process.exit(result.status);
}
const log = process.env.CALLS_PATH;
const previous = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\\n').length : 0;
fs.appendFileSync(log, JSON.stringify(args) + '\\n');
process.exit(previous < Number(process.env.FAILURES) ? 1 : 0);
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(root, 'sleep'),
    '#!/bin/sh\nprintf "%s\\n" "$1" >> "$SLEEPS_PATH"\n',
    { mode: 0o755 },
  );
  const result = spawnSync(
    'bash',
    [script, root, '8', ...(explicit ? ['3.8.2-ultramodern.10', 'next'] : [])],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${root}${path.delimiter}${process.env.PATH}`,
        CALLS_PATH: callsPath,
        SLEEPS_PATH: sleepsPath,
        FAILURES: String(failures),
      },
    },
  );
  const calls = fs
    .readFileSync(callsPath, 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  for (const args of calls) {
    assert.deepEqual(args, [
      path.resolve(__dirname, '../prepare-bleedingdev-packages.mjs'),
      '--publish-existing',
      '--dry-run',
      '--out',
      root,
      '--version',
      explicit ? '3.8.2-ultramodern.10' : manifestVersion,
      '--tag',
      explicit ? 'next' : 'latest',
      '--publish-concurrency',
      '8',
    ]);
  }
  const sleeps = fs.existsSync(sleepsPath)
    ? fs.readFileSync(sleepsPath, 'utf8').trim().split('\n')
    : [];
  assert.ok(sleeps.every(value => value === '15'));
  return { result, calls, sleeps };
}

test('registry wait stops at first success and retains caller version and tag', t => {
  const { result, calls, sleeps } = runWait(t, { failures: 0 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 1);
  assert.equal(sleeps.length, 0);
});

test('Tractor wait reads manifest identity and retries fresh verifier processes', t => {
  const { result, calls, sleeps } = runWait(t, {
    failures: 2,
    explicit: false,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 3);
  assert.equal(sleeps.length, 2);
});

test('registry wait fails closed after twelve failures without a final sleep', t => {
  const { result, calls, sleeps } = runWait(t, { failures: 12 });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Exact registry cohort did not become verifiable/u,
  );
  assert.equal(calls.length, 12);
  assert.equal(sleeps.length, 11);
});
