const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { SUPERAPP_READINESS_DIMENSIONS } = require('../../lib/artifact-schema');

const repoRoot = path.resolve(__dirname, '../../..');
const scriptPath = path.join(
  repoRoot,
  'scripts/superapp-certification/generate-readiness-report.js',
);

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'superapp-readiness-'));

test('readiness report preserves artifact dimensions and warning status', () => {
  const tempDir = makeTempDir();
  try {
    const inputDir = path.join(tempDir, 'input');
    const outDir = path.join(tempDir, 'out');
    const summaryDir = path.join(inputDir, 'custom');
    fs.mkdirSync(summaryDir, { recursive: true });
    fs.writeFileSync(
      path.join(summaryDir, 'summary.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          suite: 'custom-artifact',
          status: 'warning',
          dimensions: [...SUPERAPP_READINESS_DIMENSIONS, 'not-a-dimension'],
        },
        null,
        2,
      )}\n`,
    );

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--input-dir', inputDir, '--out-dir', outDir],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      fs.readFileSync(path.join(outDir, 'latest.json'), 'utf8'),
    );
    assert.equal(report.readiness.overallStatus, 'provisional');
    assert.deepEqual(
      Object.fromEntries(
        SUPERAPP_READINESS_DIMENSIONS.map(dimension => [
          dimension,
          report.readiness.dimensions[dimension].status,
        ]),
      ),
      Object.fromEntries(
        SUPERAPP_READINESS_DIMENSIONS.map(dimension => [dimension, 'warning']),
      ),
    );
    assert.equal(report.evidence[0].status, 'warning');
    assert.deepEqual(
      report.evidence[0].dimensions,
      SUPERAPP_READINESS_DIMENSIONS,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readiness report exposes nested skipped artifact evidence', () => {
  const tempDir = makeTempDir();
  try {
    const inputDir = path.join(tempDir, 'input');
    const outDir = path.join(tempDir, 'out');
    const summaryDir = path.join(inputDir, 'published-create');
    const summaryPath = path.join(summaryDir, 'summary.json');
    const skippedReason =
      'Cloudflare deploy proof skipped because --deploy-cloudflare was not provided.';
    fs.mkdirSync(summaryDir, { recursive: true });
    fs.writeFileSync(
      summaryPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          suite: 'ultramodern-published-create-proof',
          dimensions: ['integration', 'browser', 'module-federation'],
          status: 'warning',
          evidence: [
            {
              id: 'cloudflare-deploy-proof',
              dimensions: ['integration', 'browser'],
              status: 'skipped',
              reason: skippedReason,
              detail: {
                deployCloudflare: false,
                requiredFlag: '--deploy-cloudflare',
              },
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--input-dir', inputDir, '--out-dir', outDir],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      fs.readFileSync(path.join(outDir, 'latest.json'), 'utf8'),
    );
    const nested = report.evidence.find(
      item => item.id === 'cloudflare-deploy-proof',
    );
    assert.ok(nested);
    assert.equal(nested.status, 'skipped');
    assert.equal(nested.reason, skippedReason);
    assert.equal(nested.parentId, 'ultramodern-published-create-proof');
    assert.equal(nested.source, path.relative(repoRoot, summaryPath));
    assert.deepEqual(nested.dimensions, ['integration', 'browser']);
    assert.deepEqual(nested.detail, {
      deployCloudflare: false,
      requiredFlag: '--deploy-cloudflare',
    });
    assert.equal(report.readiness.dimensions.integration.status, 'skipped');
    assert.equal(report.readiness.dimensions.browser.status, 'skipped');
    assert.equal(
      report.readiness.dimensions['module-federation'].status,
      'warning',
    );
    assert.ok(
      report.readiness.dimensions.integration.evidence.includes(
        'cloudflare-deploy-proof',
      ),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// Restored from the deleted certification-runner.test.js: the runner must never
// report a green, qualified certification when a command fails.
test('certification runner fails loudly when a certification command fails', () => {
  const root = makeTempDir();
  const binDir = path.join(root, 'bin');
  const outDir = path.join(root, 'failure');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'pnpm'), '#!/bin/sh\nexit 23\n');
  fs.chmodSync(path.join(binDir, 'pnpm'), 0o755);
  try {
    const result = spawnSync(
      process.execPath,
      [
        path.join(path.dirname(scriptPath), 'run-superapp-certification.js'),
        '--skip-upstream-drift',
        '--out-dir',
        outDir,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CI: 'true',
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
        },
      },
    );

    assert.equal(result.status, 1, result.stderr || result.stdout);
    const summary = JSON.parse(
      fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'),
    );
    assert.equal(summary.status, 'failed');
    assert.equal(summary.qualified, false);
    assert.equal(summary.commands[0].exitCode, 23);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
