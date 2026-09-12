import assert from 'node:assert/strict';
import test from 'node:test';
import { registryVerificationRetryDelaysMs } from '../lib/prepare-bleedingdev-packages/registry.mjs';

// The post-publish verifier runs after the unrollbackable publish. If it gives
// up before npm has propagated a freshly published version into the packument,
// a complete cohort is reported as a failed publication (run 34689880072:
// one package's packument lagged for more than the 360s the loop then spent).
test('post-publish verification outlasts npm packument propagation', () => {
  const delays = [...registryVerificationRetryDelaysMs];
  const totalMs = delays.reduce((sum, delay) => sum + delay, 0);
  assert.ok(
    totalMs >= 840_000,
    `verification spends ${totalMs}ms; npm has needed more than 420s`,
  );
  // Front-loaded: a package that is already coherent is accepted in seconds.
  assert.ok(delays[0] <= 2000);
  for (let index = 1; index < delays.length; index += 1) {
    assert.ok(delays[index] >= delays[index - 1], 'delays never shrink');
  }
});
