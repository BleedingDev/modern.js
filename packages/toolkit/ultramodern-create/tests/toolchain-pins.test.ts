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
