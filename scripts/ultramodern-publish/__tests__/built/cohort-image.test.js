// This test stages actual image build output. Run after the release build;
// source publication tooling remains independently qualified before that build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../../..');
const requireFromPrebundle = createRequire(
  path.join(repoRoot, 'scripts/prebundle/package.json'),
);

test('the packed-consumer proof stages the cohort image with its aliases intact', async t => {
  const { cohortImageTargetName, proofImageVersion, stageCohortImagePackage } =
    await import('../../verify-sidecar-consumer.mjs');
  const { collectSidecarPackages, validateAliasConsistency } = await import(
    '../../lib/prepare-bleedingdev-packages/sidecars.mjs'
  );
  const semver = requireFromPrebundle(
    path.join(repoRoot, 'packages/toolkit/utils/compiled/semver/index.js'),
  );

  // The cohort image is rebuilt from the working tree every run, so its proof
  // version is unique per run: an immutable local-registry version can never be
  // republished with different bytes. The SIDECAR versions stay exact.
  const first = proofImageVersion();
  const second = proofImageVersion();
  assert.notEqual(first, second);
  assert.ok(semver.valid(first), `${first} must be valid semver`);
  assert.ok(
    semver.lt(first, '0.0.0'),
    'the proof version must be a prerelease',
  );
  assert.match(first, /^0\.0\.0-sidecar-consumer-proof\./u);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cohort-image-built-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const stageDir = path.join(scratch, 'image');
  const { packageJson, version } = stageCohortImagePackage(stageDir, {
    version: first,
  });

  assert.equal(packageJson.name, cohortImageTargetName);
  assert.equal(packageJson.version, first);
  assert.equal(version, first);
  assert.equal(packageJson.publishConfig.access, 'public');
  assert.equal(
    Object.hasOwn(packageJson.publishConfig, 'registry'),
    false,
    'the staged cohort image must carry no publish target',
  );
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(packageJson.scripts, undefined);
  // The npm: alias literals are what this whole lane exists to make
  // resolvable; the proof must publish them unchanged, pinned at the exact
  // stable sidecar versions even though the image version floats per run.
  assert.match(
    packageJson.dependencies['@rsbuild-image/core'],
    /^npm:@bleedingdev\/rsbuild-image-core@\d+\.\d+\.\d+$/u,
  );
  assert.match(
    packageJson.dependencies.ipx,
    /^npm:@bleedingdev\/ipx@\d+\.\d+\.\d+$/u,
  );
  assert.doesNotThrow(() =>
    validateAliasConsistency(
      [{ name: cohortImageTargetName, packageJson }],
      collectSidecarPackages(repoRoot),
    ),
  );
  // Staged out of tree: the repository copy keeps its own identity.
  const sourceManifest = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'packages/runtime/plugin-image/package.json'),
      'utf8',
    ),
  );
  assert.equal(sourceManifest.name, '@modern-js/image');
});
