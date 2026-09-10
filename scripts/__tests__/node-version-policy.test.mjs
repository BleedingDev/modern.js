import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import yaml from '../../packages/toolkit/utils/compiled/js-yaml/index.js';
import {
  assertSupportedNodeVersion,
  MINIMUM_NODE_VERSION,
} from '../ultramodern-node-policy/check-node-version.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('accepts the pinned Node floor and newer runtimes', () => {
  assert.equal(MINIMUM_NODE_VERSION, '26.7.0');
  assert.equal(assertSupportedNodeVersion('26.7.0'), '26.7.0');
  assert.equal(assertSupportedNodeVersion('26.8.0'), '26.8.0');
  assert.equal(assertSupportedNodeVersion('27.0.0'), '27.0.0');
});

test('rejects legacy and malformed Node runtimes with an actionable error', () => {
  for (const version of ['20.19.5', '22.23.2', '26.6.99', 'unknown']) {
    assert.throws(
      () => assertSupportedNodeVersion(version),
      error =>
        error instanceof Error &&
        error.message.includes('requires Node.js >=26.7.0') &&
        error.message.includes(`detected v${version}`) &&
        error.message.includes('mise install'),
    );
  }
});

test('app-tools rejects unsupported Node before loading dependencies', () => {
  for (const bin of ['modern.js', 'modern-bundle-docs.js']) {
    const binPath = path.join(
      repoRoot,
      'packages/solutions/app-tools/bin',
      bin,
    );
    for (const version of ['22.23.2', 'bogus']) {
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          `Object.defineProperty(process.versions, 'node', { value: '${version}' }); require(${JSON.stringify(binPath)})`,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1, `${bin} on ${version}`);
      assert.match(result.stderr, /requires Node\.js >=26\.7\.0/, bin);
      assert.match(result.stderr, new RegExp(`detected v${version}`), bin);
    }
  }
});

test('repository and executable package metadata declare the runtime floor', () => {
  for (const packagePath of [
    'package.json',
    'packages/runtime/i18n-extensions/package.json',
    'packages/runtime/runtime-extensions/package.json',
    'packages/server/runtime-extensions/package.json',
    'packages/solutions/app-tools/package.json',
  ]) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, packagePath), 'utf8'),
    );
    assert.equal(packageJson.engines.node, '>=26.7.0', packagePath);
    if (packagePath === 'package.json') {
      assert.equal(
        packageJson.scripts.preinstall,
        'node scripts/ultramodern-node-policy/check-node-version.mjs',
      );
    }
  }

  assert.equal(
    fs.readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim(),
    '26.7.0',
  );
  assert.match(
    fs.readFileSync(path.join(repoRoot, '.mise.toml'), 'utf8'),
    /^node = "26\.7\.0"$/m,
  );

  let nodeSetupCount = 0;
  const nightlyJobs = new Set([
    '.github/workflows/ultramodern-nightly.yml:script-tests',
    '.github/workflows/ultramodern-nightly.yml:superapp-certification-nightly',
  ]);
  const nightlySetupCounts = new Map([...nightlyJobs].map(job => [job, 0]));
  for (const workflowPath of fs.globSync('.github/workflows/*.{yml,yaml}', {
    cwd: repoRoot,
  })) {
    const workflow = yaml.load(
      fs.readFileSync(path.join(repoRoot, workflowPath), 'utf8'),
    );
    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      const jobId = `${workflowPath.split(path.sep).join('/')}:${jobName}`;
      for (const step of job.steps ?? []) {
        if (!step.uses?.startsWith('actions/setup-node@')) {
          continue;
        }
        nodeSetupCount += 1;
        const isNightly = nightlyJobs.has(jobId);
        assert.equal(
          String(step.with?.['node-version']),
          isNightly ? '26.x' : '26.7.0',
          jobId,
        );
        if (isNightly) {
          nightlySetupCounts.set(jobId, nightlySetupCounts.get(jobId) + 1);
        }
      }
    }
  }
  assert.ok(nodeSetupCount > 0, 'expected explicit workflow Node setup');
  for (const [jobId, count] of nightlySetupCounts) {
    assert.equal(count, 1, `${jobId} must provision nightly Node exactly once`);
  }
});

test('private examples that execute app-tools declare the same runtime floor', () => {
  for (const packagePath of fs.globSync('examples/**/package.json', {
    cwd: repoRoot,
  })) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, packagePath), 'utf8'),
    );
    const appTools =
      packageJson.dependencies?.['@modern-js/app-tools'] ??
      packageJson.devDependencies?.['@modern-js/app-tools'];
    if (packageJson.private && appTools === 'workspace:*') {
      assert.equal(packageJson.engines?.node, '>=26.7.0', packagePath);
    }
  }
});
