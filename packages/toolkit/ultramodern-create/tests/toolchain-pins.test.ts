import assert from 'node:assert/strict';
import { updateRootPackageToolchain } from '../src/ultramodern-tooling/commands/migrate-strict-effect/toolchain-pins';

test('migration preserves a newer pnpm minor while upgrading retired versions', () => {
  for (const [before, after] of [
    ['pnpm@11.25.0', 'pnpm@11.25.0'],
    ['pnpm@11.9.0', 'pnpm@11.24.0'],
    ['pnpm@9.0.0', 'pnpm@11.24.0'],
  ]) {
    const manifest = { packageManager: before };
    updateRootPackageToolchain(manifest);
    assert.equal(manifest.packageManager, after);
  }
});

test('root migration removes retired TS6 tooling without dropping consumer dependencies', () => {
  const packageJson = {
    devDependencies: {
      '@typescript/typescript6': '6.0.2',
      'consumer-owned-tool': '1.2.3',
    },
    engines: {
      consumer: 'preserved',
    },
  };

  updateRootPackageToolchain(packageJson);

  assert.deepEqual(packageJson.devDependencies, {
    '@types/node': '^26.4.1',
    '@typescript/native': 'npm:typescript@7.0.2',
    'consumer-owned-tool': '1.2.3',
    miniflare: '4.20260730.0',
  });
  assert.equal(packageJson.engines.consumer, 'preserved');
  assert.equal(typeof packageJson.engines.node, 'string');
  assert.equal(typeof packageJson.engines.pnpm, 'string');
  assert.match(packageJson.packageManager, /^pnpm@/u);
});
