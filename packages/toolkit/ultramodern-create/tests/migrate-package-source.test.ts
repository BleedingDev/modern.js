import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMigrationPackageSource } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-source';
import { readUltramodernConfig } from '../src/ultramodern-tooling/config';
import { createPackageRoot } from '../src/ultramodern-workspace/fs-io';
import { createWorkspace } from './helpers/workspace-kit';

const migrationVersion = '3.8.2-ultramodern.7';

test('migration preserves persisted install and workspace registries unless the CLI overrides them', () => {
  const { tempRoot, workspaceDir } = createWorkspace(
    'migration-package-source-registry',
    { tempPrefix: 'um-migration-package-source-registry-' },
  );
  let sourceCheckoutSpy: ReturnType<typeof rstest.spyOn> | undefined;
  try {
    const current = readUltramodernConfig(workspaceDir);
    const checkoutPath = path.join(createPackageRoot, 'src');
    const actualExistsSync = fs.existsSync.bind(fs);
    sourceCheckoutSpy = rstest
      .spyOn(fs, 'existsSync')
      .mockImplementation(candidate => {
        if (
          typeof candidate === 'string' &&
          path.resolve(candidate) === checkoutPath
        ) {
          return false;
        }
        return actualExistsSync(candidate);
      });

    for (const registry of [
      'https://registry.npmjs.org/',
      'https://packages.example.test/npm/',
    ]) {
      current.packageSource = {
        modernPackageVersion: migrationVersion,
        registry,
        strategy: 'install',
      };

      assert.equal(
        createMigrationPackageSource([], current).registry,
        registry,
      );
      assert.equal(
        createMigrationPackageSource(['--workspace'], current).registry,
        registry,
      );
    }

    const overrideRegistry = 'https://override.example.test/npm/';
    assert.equal(
      createMigrationPackageSource(
        ['--workspace', '--registry', overrideRegistry],
        current,
      ).registry,
      overrideRegistry,
    );
    assert.equal(
      createMigrationPackageSource(
        ['--workspace', '--ultramodern-package-registry', overrideRegistry],
        current,
      ).registry,
      overrideRegistry,
    );
  } finally {
    sourceCheckoutSpy?.mockRestore();
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test('local source checkout still rejects a persisted install package source', () => {
  const { tempRoot, workspaceDir } = createWorkspace(
    'migration-package-source-fail-closed',
    { tempPrefix: 'um-migration-package-source-fail-closed-' },
  );

  try {
    const current = readUltramodernConfig(workspaceDir);
    current.packageSource = {
      modernPackageVersion: migrationVersion,
      registry: 'https://packages.example.test/npm/',
      strategy: 'install',
    };

    assert.throws(
      () => createMigrationPackageSource([], current),
      /local @modern-js\/ultramodern-create source checkout cannot migrate an explicit install package source/u,
    );
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});
