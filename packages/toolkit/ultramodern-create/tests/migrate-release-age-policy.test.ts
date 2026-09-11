import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yaml } from '@modern-js/utils';
import type { ResolvedUltramodernPackageSource } from '../src/ultramodern-package-source';
import { parseUltramodernReleaseCohort } from '../src/ultramodern-release-cohort';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import {
  type ReleaseAgeRegistryFetch,
  updateGeneratedPnpmWorkspacePolicy,
  validateGeneratedPnpmLockReleaseAgePolicy,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/pnpm-policy';
import { renderMinimumReleaseAgeExclude } from '../src/ultramodern-workspace/policy';

const now = new Date('2026-07-10T12:00:00.000Z');
const packageSource: ResolvedUltramodernPackageSource = {
  strategy: 'install',
  modernPackageVersion: '3.5.0-ultramodern.1',
  registry: 'https://registry.npmjs.org/',
  aliasScope: 'bleedingdev',
  aliasPackageNamePrefix: 'modern-js-',
};
const integrity =
  'sha512-2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA==';
const releaseCohort = parseUltramodernReleaseCohort({
  aliases: { '@modern-js/create': '@bleedingdev/modern-js-create' },
  packages: [
    {
      sourceName: '@modern-js/create',
      targetName: '@bleedingdev/modern-js-create',
      version: packageSource.modernPackageVersion,
    },
  ],
  release: { tag: 'latest', version: packageSource.modernPackageVersion },
  schema: 'bleedingdev.ultramodern.release-cohort',
  schemaVersion: 1,
  source: { commit: 'a'.repeat(40), repository: 'bleedingdev/modern.js' },
});

function createWorkspace(lockfile: Record<string, unknown>) {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-release-age-'),
  );
  fs.writeFileSync(
    path.join(workspaceRoot, 'pnpm-workspace.yaml'),
    yaml.dump({
      minimumReleaseAgeExclude: renderMinimumReleaseAgeExclude({
        now,
        packageSource,
        releaseCohort,
      }),
    }),
  );
  fs.writeFileSync(
    path.join(workspaceRoot, 'pnpm-lock.yaml'),
    yaml.dump(lockfile),
  );
  fs.mkdirSync(path.join(workspaceRoot, '.modernjs'), { recursive: true });
  fs.writeFileSync(
    path.join(workspaceRoot, '.modernjs/release-cohort.json'),
    `${JSON.stringify(releaseCohort, null, 2)}\n`,
  );
  return workspaceRoot;
}

function lockfileWithImporter(dependencyName: string, version: string) {
  return {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          [dependencyName]: { specifier: version, version },
        },
      },
    },
    packages: { [version]: { resolution: { integrity } } },
    snapshots: { [version]: {} },
  };
}

function packument(version: string, publishedAt: string) {
  return {
    time: { [version]: publishedAt },
    versions: { [version]: { dist: { integrity } } },
  };
}

function registryFetch(
  packuments: Record<string, Record<string, unknown>>,
): ReleaseAgeRegistryFetch {
  return async url => {
    const found = packuments[decodeURIComponent(url.pathname.slice(1))];
    return {
      ok: Boolean(found),
      status: found ? 200 : 404,
      json: async () => found,
    };
  };
}

function validate(
  workspaceRoot: string,
  packuments: Record<string, Record<string, unknown>> = {},
) {
  return validateGeneratedPnpmLockReleaseAgePolicy(
    workspaceRoot,
    packageSource,
    {
      fetchImpl: registryFetch(packuments),
      now,
      registryUrl: 'https://registry.example.test/',
      releaseCohort,
    },
  );
}

test('migrate retires stale release-age exclusions and refuses unapproved ones without writing', () => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-stale-release-age-'),
  );
  const workspaceFile = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  const migrationNow = new Date('2026-09-08T00:00:00.000Z');
  const staleSelectors = ['effect@4.0.0-beta.107', 'oxlint@1.78.0'];

  try {
    fs.writeFileSync(path.join(workspaceRoot, 'package.json'), '{}\n');
    fs.writeFileSync(
      workspaceFile,
      yaml.dump({ minimumReleaseAgeExclude: staleSelectors }),
    );

    assert.equal(
      updateGeneratedPnpmWorkspacePolicy(
        createMigrationIo(workspaceRoot, false),
        packageSource,
        { now: migrationNow, releaseCohort },
      ),
      true,
    );

    const migratedPolicy = yaml.load(
      fs.readFileSync(workspaceFile, 'utf-8'),
    ) as {
      minimumReleaseAgeExclude: string[];
    };
    assert.deepEqual(
      migratedPolicy.minimumReleaseAgeExclude,
      renderMinimumReleaseAgeExclude({
        now: migrationNow,
        packageSource,
        releaseCohort,
      }),
    );
    assert.equal(
      staleSelectors.some(selector =>
        migratedPolicy.minimumReleaseAgeExclude.includes(selector),
      ),
      false,
    );

    fs.writeFileSync(
      workspaceFile,
      yaml.dump({
        minimumReleaseAgeExclude: [...staleSelectors, '@oxlint/plugins@1.78.0'],
      }),
    );
    const unreviewedPolicy = fs.readFileSync(workspaceFile);
    assert.throws(
      () =>
        updateGeneratedPnpmWorkspacePolicy(
          createMigrationIo(workspaceRoot, false),
          packageSource,
          { now: migrationNow, releaseCohort },
        ),
      /Unapproved release-age exclusion "@oxlint\/plugins@1\.78\.0"/u,
    );
    assert.deepEqual(fs.readFileSync(workspaceFile), unreviewedPolicy);
  } finally {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

test('rejects a reachable immature dependency without an approval', async () => {
  const workspaceRoot = createWorkspace(
    lockfileWithImporter('unapproved-package', 'unapproved-package@1.0.0'),
  );

  try {
    await assert.rejects(
      () =>
        validate(workspaceRoot, {
          'unapproved-package': packument('1.0.0', '2026-07-10T11:00:00.000Z'),
        }),
      /Dependency closure contains 1 immature package\(s\) without an exact, unexpired approval:[\s\S]*unapproved-package@1\.0\.0/u,
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('accepts a reachable mature dependency without an approval', async () => {
  const workspaceRoot = createWorkspace(
    lockfileWithImporter('mature-package', 'mature-package@1.0.0'),
  );

  try {
    assert.deepEqual(
      (
        await validate(workspaceRoot, {
          'mature-package': packument('1.0.0', '2026-07-01T12:00:00.000Z'),
        })
      ).reviewCandidates,
      [],
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('rejects non-loopback HTTP scope registries and disables registry redirects', async () => {
  // A cohort-scope package outside the authenticated cohort (a sidecar) is the
  // only kind of candidate that reads the package-source registry.
  const sidecar = '@bleedingdev/sidecar-fixture';
  const workspaceRoot = createWorkspace(
    lockfileWithImporter(sidecar, `${sidecar}@1.0.0`),
  );

  try {
    await assert.rejects(
      () =>
        validateGeneratedPnpmLockReleaseAgePolicy(
          workspaceRoot,
          packageSource,
          {
            fetchImpl: registryFetch({}),
            now,
            registryUrl: 'http://registry.example.test/',
            releaseCohort,
          },
        ),
      /Registry URL must use HTTPS/u,
    );

    await assert.rejects(
      () =>
        validateGeneratedPnpmLockReleaseAgePolicy(
          workspaceRoot,
          packageSource,
          {
            fetchImpl: async (_url, init) => {
              assert.equal(init.redirect, 'error');
              throw new Error('redirect rejected');
            },
            now,
            registryUrl: 'https://registry.example.test/',
            releaseCohort,
          },
        ),
      /Registry metadata is uncertain.*redirect rejected/u,
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('validates cohort-scope packuments on the package-source registry and everything else on npmjs', async () => {
  const cohortTarget = `@bleedingdev/modern-js-create@${packageSource.modernPackageVersion}`;
  const sidecar = '@bleedingdev/sidecar-fixture';
  const thirdParty = 'third-party-fixture';
  const workspaceRoot = createWorkspace({
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          '@modern-js/create': {
            specifier: `npm:${cohortTarget}`,
            version: cohortTarget,
          },
          [sidecar]: { specifier: '1.0.0', version: '1.0.0' },
          [thirdParty]: { specifier: '1.0.0', version: '1.0.0' },
        },
      },
    },
    packages: {
      [cohortTarget]: { resolution: { integrity } },
      [`${sidecar}@1.0.0`]: { resolution: { integrity } },
      [`${thirdParty}@1.0.0`]: { resolution: { integrity } },
    },
    snapshots: {
      [cohortTarget]: {},
      [`${sidecar}@1.0.0`]: {},
      [`${thirdParty}@1.0.0`]: {},
    },
  });
  const origins = new Map<string, string>();

  try {
    const validated = await validateGeneratedPnpmLockReleaseAgePolicy(
      workspaceRoot,
      // The source-mode release rehearsal passes its loopback ephemeral
      // registry, which only ever serves the cohort scope.
      { ...packageSource, registry: 'http://127.0.0.1:4873/' },
      {
        async fetchImpl(url) {
          origins.set(decodeURIComponent(url.pathname.slice(1)), url.origin);
          return {
            ok: true,
            status: 200,
            json: async () => packument('1.0.0', '2026-07-01T00:00:00.000Z'),
          };
        },
        now,
        releaseCohort,
      },
    );

    assert.deepEqual(validated.reviewCandidates, []);
    // Authenticated cohort members are never fetched from any registry.
    assert.deepEqual([...origins.entries()].sort(), [
      [sidecar, 'http://127.0.0.1:4873'],
      [thirdParty, 'https://registry.npmjs.org'],
    ]);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('rejects package-source aliases that rebind the authenticated cohort', () => {
  assert.throws(
    () =>
      renderMinimumReleaseAgeExclude({
        now,
        packageSource: { ...packageSource, aliasScope: 'attacker' },
        releaseCohort,
      }),
    /Package source aliases rebind the authenticated release cohort/u,
  );
});
