import assert from 'node:assert/strict';
import { updateModernDependencies } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort';

test('migration updates declared extension packages throughout the authenticated cohort', () => {
  const source = {
    strategy: 'install' as const,
    modernPackageVersion: '3.9.0-ultramodern.4',
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  const cohort = {
    packages: [
      {
        sourceName: '@modern-js/app-tools-extensions',
        targetName: '@bleedingdev/modern-js-app-tools-extensions',
        version: source.modernPackageVersion,
      },
    ],
  };
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const manifest = {
      [section]: {
        '@modern-js/app-tools-extensions':
          'npm:@bleedingdev/modern-js-app-tools-extensions@3.9.0-ultramodern.2',
        '@bleedingdev/modern-js-app-tools-extensions': '3.9.0-ultramodern.2',
        '@modern-js/codesmith': '2.6.9',
        'consumer-tool': '1.2.3',
      },
    };
    assert.equal(updateModernDependencies(manifest, source, cohort), true);
    assert.deepEqual(manifest[section], {
      '@modern-js/app-tools-extensions':
        'npm:@bleedingdev/modern-js-app-tools-extensions@3.9.0-ultramodern.4',
      '@bleedingdev/modern-js-app-tools-extensions': '3.9.0-ultramodern.4',
      '@modern-js/codesmith': '2.6.9',
      'consumer-tool': '1.2.3',
    });
    assert.equal(updateModernDependencies(manifest, source, cohort), false);
  }
});

import { parseUltramodernReleaseCohort } from '../src/ultramodern-release-cohort';
import { updateSameContractDependencies } from '../src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort';
import {
  assertSameContractDelta,
  replaceJsonStringLeaves,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/same-contract';

function cohort(version: string) {
  return parseUltramodernReleaseCohort({
    schema: 'bleedingdev.ultramodern.release-cohort',
    schemaVersion: 1,
    source: {
      commit: `commit-${version}`,
      repository: 'https://github.com/BleedingDev/ultramodern.js',
    },
    release: { tag: version, version },
    aliases: { '@modern-js/runtime': '@bleedingdev/modern-js-runtime' },
    packages: [
      {
        sourceName: '@modern-js/runtime',
        targetName: '@bleedingdev/modern-js-runtime',
        version,
      },
    ],
  });
}

test('same-contract dependency update cannot add a runtime extension or rename creator', () => {
  const source = cohort('3.9.0-ultramodern.3');
  const target = cohort('3.9.0-ultramodern.4');
  const manifest = {
    scripts: { custom: 'keep me' },
    dependencies: {
      '@modern-js/runtime':
        'npm:@bleedingdev/modern-js-runtime@3.9.0-ultramodern.3',
      '@modern-js/create': 'consumer-owned',
      consumer: '^1.2.3',
    },
  };
  assert.deepEqual(updateSameContractDependencies(manifest, source, target), [
    {
      section: 'dependencies',
      name: '@modern-js/runtime',
      value: 'npm:@bleedingdev/modern-js-runtime@3.9.0-ultramodern.4',
    },
  ]);
  assert.deepEqual(manifest, {
    scripts: { custom: 'keep me' },
    dependencies: {
      '@modern-js/runtime':
        'npm:@bleedingdev/modern-js-runtime@3.9.0-ultramodern.4',
      '@modern-js/create': 'consumer-owned',
      consumer: '^1.2.3',
    },
  });
});

test('same-contract rejects a declaration that does not match the authenticated source', () => {
  assert.throws(
    () =>
      updateSameContractDependencies(
        { dependencies: { '@modern-js/runtime': '^3.9.0' } },
        cohort('3.9.0-ultramodern.3'),
        cohort('3.9.0-ultramodern.4'),
      ),
    /authenticated source cohort/,
  );
});

test('JSON release edits preserve every unrelated byte and reject duplicate ownership', () => {
  const original =
    '{\r\n\t"scripts" : {"keep":"old"}, "dependencies": {"@modern-js/runtime" : "old"}, "unknown": ["old",1]\r\n}\r\n';
  const expected = original.replace(
    '"@modern-js/runtime" : "old"',
    '"@modern-js/runtime" : "new"',
  );
  assert.equal(
    replaceJsonStringLeaves(original, [
      { keys: ['dependencies', '@modern-js/runtime'], value: 'new' },
    ]),
    expected,
  );
  assert.throws(
    () =>
      replaceJsonStringLeaves('{"x":"old","x":"old"}', [
        { keys: ['x'], value: 'new' },
      ]),
    /duplicate JSON property/,
  );
});

test('net delta rejects a target subprocess changing consumer source or unprepared JSON', () => {
  const plan = {
    classification: 'same-contract' as const,
    reason: '',
    writes: [{ path: 'package.json', content: 'prepared' }],
    manifests: ['package.json'],
    coherentLock: false,
  };
  const file = (content: string) => ({
    content: Buffer.from(content),
    mode: 0o644,
  });
  assert.throws(
    () =>
      assertSameContractDelta(plan, [
        {
          relativePath: 'src/main.ts',
          before: file('before'),
          after: file('after'),
        },
      ]),
    /unapproved change/,
  );
  assert.throws(
    () =>
      assertSameContractDelta(plan, [
        {
          relativePath: 'package.json',
          before: file('before'),
          after: file('unprepared'),
        },
      ]),
    /unapproved change/,
  );
  assert.doesNotThrow(() =>
    assertSameContractDelta(plan, [
      {
        relativePath: 'package.json',
        before: file('before'),
        after: file('prepared'),
      },
    ]),
  );
});

import { shellApp } from '../src/ultramodern-workspace/descriptors';
import type { WorkspaceApp } from '../src/ultramodern-workspace/types';

test('historical migration registers app providers by declared surface and preserves consumer dependency sections', () => {
  const source = {
    strategy: 'workspace' as const,
    modernPackageVersion: 'workspace:*',
  };
  const cases: Array<{ app?: WorkspaceApp; runtime: string[] }> = [
    {
      app: shellApp,
      runtime: [
        '@modern-js/federation-runtime',
        '@modern-js/boundary-debugger',
      ],
    },
    {
      app: { ...shellApp, kind: 'vertical', surfaceProfile: 'ui-only' },
      runtime: ['@modern-js/federation-runtime'],
    },
    {
      app: { ...shellApp, kind: 'vertical', surfaceProfile: 'api-only' },
      runtime: [],
    },
    { runtime: [] },
  ];
  for (const { app, runtime } of cases) {
    const manifest: Record<string, any> = {
      dependencies: { consumer: '^1.2.3' },
      devDependencies: { 'consumer-tool': '^2.3.4' },
      peerDependencies: { 'consumer-peer': '^3.4.5' },
      optionalDependencies: { 'consumer-optional': '^4.5.6' },
      scripts: { custom: 'consumer --keep' },
    };
    updateModernDependencies(manifest, source, undefined, { app });
    assert.deepEqual(manifest.dependencies, {
      consumer: '^1.2.3',
      ...Object.fromEntries(runtime.map(name => [name, 'workspace:*'])),
    });
    assert.deepEqual(manifest.devDependencies, {
      'consumer-tool': '^2.3.4',
      ...(app
        ? {
            '@modern-js/ultramodern-app-tools': 'workspace:*',
            '@modern-js/app-tools-extensions': 'workspace:*',
          }
        : {}),
    });
    assert.deepEqual(manifest.peerDependencies, { 'consumer-peer': '^3.4.5' });
    assert.deepEqual(manifest.optionalDependencies, {
      'consumer-optional': '^4.5.6',
    });
    assert.deepEqual(manifest.scripts, { custom: 'consumer --keep' });
    assert.equal(
      updateModernDependencies(manifest, source, undefined, { app }),
      false,
    );
  }
});

test('historical app provider registration rejects an incomplete target cohort before changing the manifest', () => {
  const source = {
    strategy: 'install' as const,
    modernPackageVersion: '3.9.0-ultramodern.4',
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  const manifest = { dependencies: { consumer: '^1.2.3' } };
  assert.throws(
    () =>
      updateModernDependencies(
        manifest,
        source,
        { packages: [] },
        { app: shellApp },
      ),
    /absent from the authenticated target cohort/,
  );
  assert.deepEqual(manifest, { dependencies: { consumer: '^1.2.3' } });
});
