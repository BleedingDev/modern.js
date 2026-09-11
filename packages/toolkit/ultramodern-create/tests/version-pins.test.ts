import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yaml } from '@modern-js/utils';
import { ULTRAMODERN_WORKSPACE_MODERN_PACKAGES } from '../src/ultramodern-package-source';
import { RELEASE_COHORT_PROJECTION_PATH } from '../src/ultramodern-release-cohort';
import { generateUltramodernWorkspace } from '../src/ultramodern-workspace';
import { createPackageRoot } from '../src/ultramodern-workspace/fs-io';
import { SHARED_ULTRAMODERN_WORKSPACE_PATCH_FILES } from '../src/ultramodern-workspace/shared-patches';
import { MODULE_FEDERATION_VERSION } from '../src/ultramodern-workspace/versions';

test('generated workspace renders the pins from versions.ts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-version-pins-'));
  const workspaceDir = path.join(tempRoot, 'pins-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceDir,
      packageName: 'pins-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: {
        strategy: 'workspace',
        modernPackageVersion: 'workspace:*',
      },
    });

    const readGenerated = (relativePath: string) =>
      fs.readFileSync(path.join(workspaceDir, relativePath), 'utf-8');

    const pnpmWorkspace = readGenerated('pnpm-workspace.yaml');
    const pnpmPolicy = yaml.load(pnpmWorkspace) as Record<string, any>;
    assert.ok(
      fs.existsSync(
        path.join(
          workspaceDir,
          `patches/@module-federation__dts-plugin@${MODULE_FEDERATION_VERSION}.patch`,
        ),
      ),
      'generated Module Federation DTS patch file must match MODULE_FEDERATION_VERSION',
    );
    assert.ok(
      fs.existsSync(
        path.join(
          workspaceDir,
          `patches/@module-federation__modern-js-v3@${MODULE_FEDERATION_VERSION}.patch`,
        ),
      ),
      'generated Module Federation Modern.js patch file must match MODULE_FEDERATION_VERSION',
    );
    assert.ok(
      fs.existsSync(
        path.join(
          workspaceDir,
          `patches/@module-federation__bridge-react@${MODULE_FEDERATION_VERSION}.patch`,
        ),
      ),
      'generated Module Federation React bridge patch file must match MODULE_FEDERATION_VERSION',
    );
    assert.ok(
      fs.existsSync(
        path.join(
          workspaceDir,
          `patches/@module-federation__runtime-core@${MODULE_FEDERATION_VERSION}.patch`,
        ),
      ),
      'generated Module Federation runtime-core patch file must match MODULE_FEDERATION_VERSION',
    );
    assert.equal(
      fs.existsSync(
        path.join(workspaceDir, 'patches/effect-schema-error-type-id.patch'),
      ),
      false,
      'generated workspaces must not carry the retired Effect declaration patch',
    );
    assert.ok(
      fs.existsSync(
        path.join(
          workspaceDir,
          'patches/drizzle-orm-ts7-strict-declarations.patch',
        ),
      ),
      'generated Drizzle declaration patch file must be present',
    );
    assert.ok(
      !pnpmPolicy.minimumReleaseAgeExclude.some(selector =>
        selector.startsWith('@bleedingdev/modern-js-'),
      ),
      'local workspace generation must not add first-party registry exemptions',
    );
    for (const selector of pnpmPolicy.minimumReleaseAgeExclude) {
      const separator = selector.lastIndexOf('@');
      assert.ok(separator > 0, `${selector} must include an exact version`);
      assert.match(
        selector.slice(separator + 1),
        /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
        `${selector} must not use a range, tag, bare name, or glob`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

// Restored: the shipped template patches are the exact bytes a generated
// workspace installs. If they drift from the repository patches that pnpm
// verifies here, a consumer's `pnpm install` applies stale/unapplicable
// patch bytes.
test('shipped template patches are byte-identical to the repository patches', () => {
  const repoPatchDir = path.resolve(createPackageRoot, '../../..', 'patches');
  const templatePatchDir = path.join(
    createPackageRoot,
    'template-workspace/patches',
  );
  assert.ok(SHARED_ULTRAMODERN_WORKSPACE_PATCH_FILES.length > 0);
  for (const patchFile of SHARED_ULTRAMODERN_WORKSPACE_PATCH_FILES) {
    assert.deepEqual(
      fs.readFileSync(path.join(templatePatchDir, patchFile)),
      fs.readFileSync(path.join(repoPatchDir, patchFile)),
      `${patchFile} differs between the repository and the shipped template`,
    );
  }
});

test('local source generation rejects an explicit install request', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-install-source-'));
  const workspaceDir = path.join(tempRoot, 'install-workspace');

  try {
    assert.throws(
      () =>
        generateUltramodernWorkspace({
          targetDir: workspaceDir,
          packageName: 'install-workspace',
          modernVersion: '3.2.1',
          packageSource: {
            strategy: 'install',
            modernPackageVersion: '3.2.1',
          },
        }),
      /local @modern-js\/ultramodern-create source checkout cannot satisfy an explicit install/u,
    );
    assert.equal(fs.existsSync(workspaceDir), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('a stale source projection cannot authorize local generation', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-source-cohort-'));
  const workspaceDir = path.join(tempRoot, 'source-workspace');
  const projectionPath = path.join(
    createPackageRoot,
    'template-workspace',
    RELEASE_COHORT_PROJECTION_PATH,
  );
  const projectionDirectory = path.dirname(projectionPath);
  const projectionDirectoryExists = fs.existsSync(projectionDirectory);
  const originalProjection = fs.existsSync(projectionPath)
    ? fs.readFileSync(projectionPath)
    : undefined;

  try {
    const aliases = Object.fromEntries(
      ULTRAMODERN_WORKSPACE_MODERN_PACKAGES.map(sourceName => [
        sourceName,
        `@bleedingdev/modern-js-${sourceName.slice(sourceName.lastIndexOf('/') + 1)}`,
      ]),
    );
    fs.mkdirSync(projectionDirectory, { recursive: true });
    fs.writeFileSync(
      projectionPath,
      `${JSON.stringify(
        {
          aliases,
          packages: ULTRAMODERN_WORKSPACE_MODERN_PACKAGES.map(sourceName => ({
            sourceName,
            targetName: aliases[sourceName],
            version: '0.0.0-stale',
          })),
          release: { tag: 'stale', version: '0.0.0-stale' },
          schema: 'bleedingdev.ultramodern.release-cohort',
          schemaVersion: 1,
          source: { commit: 'a'.repeat(40), repository: 'example/source' },
        },
        null,
        2,
      )}\n`,
    );

    generateUltramodernWorkspace({
      targetDir: workspaceDir,
      packageName: 'source-workspace',
      modernVersion: '3.2.1',
    });

    const compact = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDir, '.modernjs/ultramodern.json'),
        'utf8',
      ),
    );
    assert.equal(compact.packageSource.strategy, 'workspace');
    assert.equal(compact.packageSource.modernPackageVersion, 'workspace:*');
    assert.equal(
      fs.existsSync(path.join(workspaceDir, RELEASE_COHORT_PROJECTION_PATH)),
      false,
    );
    const pnpmPolicy = yaml.load(
      fs.readFileSync(path.join(workspaceDir, 'pnpm-workspace.yaml'), 'utf8'),
    ) as Record<string, any>;
    assert.equal(
      pnpmPolicy.minimumReleaseAgeExclude.some((selector: string) =>
        selector.startsWith('@bleedingdev/modern-js-'),
      ),
      false,
    );
  } finally {
    if (originalProjection) {
      fs.writeFileSync(projectionPath, originalProjection);
    } else {
      fs.rmSync(projectionPath, { force: true });
      if (!projectionDirectoryExists) {
        fs.rmdirSync(projectionDirectory);
      }
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
