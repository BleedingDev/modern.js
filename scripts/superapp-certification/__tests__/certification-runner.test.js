const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const scriptPath = path.join(
  repoRoot,
  'scripts/superapp-certification/run-superapp-certification.js',
);

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'superapp-certification-runner-'));

const makeFailingPnpm = root => {
  const binDir = path.join(root, 'bin');
  const markerPath = path.join(root, 'pnpm-invoked.json');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    path.join(binDir, 'pnpm'),
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      'fs.writeFileSync(process.env.RUNNER_CONTROL_TEST_MARKER, JSON.stringify(process.argv.slice(2)));',
      'process.exit(23);',
      '',
    ].join('\n'),
  );
  fs.chmodSync(path.join(binDir, 'pnpm'), 0o755);
  return { binDir, markerPath };
};

const runRunner = (args, env = {}) =>
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true', ...env },
  });

const readSummary = outDir =>
  JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'));

test('dry-run records planned, unqualified, and skipped command evidence', () => {
  const root = makeTempDir();
  const outDir = path.join(root, 'dry-run');
  const { binDir, markerPath } = makeFailingPnpm(root);
  try {
    const result = runRunner(
      ['--dry-run', '--skip-upstream-drift', '--out-dir', outDir],
      {
        PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
        RUNNER_CONTROL_TEST_MARKER: markerPath,
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(markerPath), false);
    const summary = readSummary(outDir);
    assert.equal(summary.status, 'planned');
    assert.equal(summary.qualified, false);
    assert.equal(summary.commandCount, 1);
    assert.equal(summary.skippedCommandCount, 1);
    assert.equal(summary.qualification.executedCommandCount, 0);
    assert.equal(summary.qualification.skippedCommandCount, 1);
    assert.deepEqual(summary.qualification.reasons, ['dry-run']);
    assert.equal(summary.commands[0].status, 'planned');
    assert.equal(summary.mergeConflictCheck.status, 'skipped');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('drift-only records unqualified merge-conflict-check-only evidence', () => {
  const root = makeTempDir();
  const outDir = path.join(root, 'drift-only');
  try {
    const result = runRunner([
      '--drift-only',
      '--skip-upstream-drift',
      '--out-dir',
      outDir,
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = readSummary(outDir);
    assert.equal(summary.status, 'skipped');
    assert.equal(summary.qualified, false);
    assert.equal(summary.commandCount, 0);
    assert.equal(summary.skippedCommandCount, 0);
    assert.deepEqual(summary.qualification.reasons, [
      'merge-conflict-check-only',
    ]);
    assert.equal(summary.mergeConflictCheck.status, 'skipped');
    assert.equal(
      summary.mergeConflictCheck.reason,
      'skip-merge-conflict-check',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runner propagates a failing certification command exit code', () => {
  const root = makeTempDir();
  const outDir = path.join(root, 'failure');
  const { binDir, markerPath } = makeFailingPnpm(root);
  try {
    const result = runRunner(['--skip-upstream-drift', '--out-dir', outDir], {
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
      RUNNER_CONTROL_TEST_MARKER: markerPath,
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(fs.readFileSync(markerPath, 'utf8')), [
      'exec',
      'rstest',
      'run',
      '-c',
      'rstest.config.mts',
      'integration/routes-tanstack-mf/test/deploy-certification.test.ts',
    ]);
    const summary = readSummary(outDir);
    assert.equal(summary.status, 'failed');
    assert.equal(summary.qualified, false);
    assert.equal(summary.failedCommandCount, 1);
    assert.equal(summary.commands[0].status, 'failed');
    assert.equal(summary.commands[0].exitCode, 23);
    assert.deepEqual(summary.qualification.reasons, [
      'certification-command-failed',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
