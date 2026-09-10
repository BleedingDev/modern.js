const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const repoRoot = path.resolve(__dirname, '../../..');
const entrypointPath = path.join(
  repoRoot,
  'scripts/ultramodern-publish/validate-source-create-proof.mjs',
);

test('root source-create gate executes exact-artifact source acceptance with canonical defaults', async () => {
  const { defaultManifestPath, defaultReceiptPath, main } = await import(
    pathToFileURL(entrypointPath)
  );
  const calls = [];
  const result = await main([], {}, async (argv, env) => {
    calls.push({ argv, env });
    return 0;
  });

  assert.equal(result, 0);
  assert.deepEqual(calls, [
    {
      argv: [
        '--manifest',
        defaultManifestPath,
        '--receipt',
        defaultReceiptPath,
        '--scale-profile',
        'erp-10',
        '--run-identity',
        'local:source-create-proof',
      ],
      env: {},
    },
  ]);
});

test('root source-create gate preserves explicit inputs and workflow identity', async () => {
  const { sourceCreateProofArgs } = await import(pathToFileURL(entrypointPath));
  const argv = [
    '--',
    '--manifest',
    '/tmp/release/manifest.json',
    '--receipt',
    '/tmp/release/receipt.json',
    '--release-age-policy',
    '/tmp/release/policy.json',
  ];
  assert.deepEqual(
    sourceCreateProofArgs(argv, {
      GITHUB_REPOSITORY: 'BleedingDev/ultramodern.js',
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: '1',
    }),
    [
      '--manifest',
      '/tmp/release/manifest.json',
      '--receipt',
      '/tmp/release/receipt.json',
      '--release-age-policy',
      '/tmp/release/policy.json',
      '--scale-profile',
      'erp-10',
    ],
  );
});

test('root source-create gate cannot be reduced to receipt verification or published acceptance', async () => {
  const { sourceCreateProofArgs } = await import(pathToFileURL(entrypointPath));
  assert.throws(
    () => sourceCreateProofArgs(['--verify-receipt']),
    /always executes source acceptance/u,
  );
  assert.throws(
    () => sourceCreateProofArgs(['--mode', 'published']),
    /always executes source acceptance/u,
  );
  assert.throws(
    () => sourceCreateProofArgs(['--mode=verify']),
    /always executes source acceptance/u,
  );
});
