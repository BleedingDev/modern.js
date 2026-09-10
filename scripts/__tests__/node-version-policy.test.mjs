import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertSupportedNodeVersion,
  MINIMUM_NODE_VERSION,
} from '../ultramodern-node-policy/check-node-version.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('accepts the policy Node floor and newer runtimes', () => {
  assert.equal(
    assertSupportedNodeVersion(MINIMUM_NODE_VERSION),
    MINIMUM_NODE_VERSION,
  );
  assert.equal(assertSupportedNodeVersion('26.8.0'), '26.8.0');
  assert.equal(assertSupportedNodeVersion('27.0.0'), '27.0.0');
});

test('rejects legacy and malformed Node runtimes with an actionable error', () => {
  for (const version of ['20.19.5', '22.23.2', '26.6.99', 'unknown']) {
    assert.throws(
      () => assertSupportedNodeVersion(version),
      error =>
        error instanceof Error &&
        error.message.includes(`requires Node.js >=${MINIMUM_NODE_VERSION}`) &&
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
