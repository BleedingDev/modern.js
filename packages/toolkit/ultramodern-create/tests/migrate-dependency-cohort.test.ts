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
  prepareSameContractUpdate,
  replaceJsonStringLeaves,
  replaceReleaseAgeSelectors,
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
        '@modern-js/plugin-bff-extensions',
        '@modern-js/runtime-renderer-extensions',
        '@modern-js/i18n-integration',
      ],
    },
    {
      app: { ...shellApp, kind: 'vertical', surfaceProfile: 'ui-only' },
      runtime: [
        '@modern-js/federation-runtime',
        '@modern-js/runtime-renderer-extensions',
        '@modern-js/i18n-integration',
      ],
    },
    {
      app: { ...shellApp, kind: 'vertical', surfaceProfile: 'api-only' },
      runtime: [
        '@modern-js/runtime-renderer-extensions',
        '@modern-js/i18n-integration',
      ],
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

test('historical BFF build adoption authenticates providers without adding build tooling to shared runtime packages', () => {
  const source = {
    strategy: 'install' as const,
    modernPackageVersion: '3.9.0-ultramodern.4',
  };
  const app = { ...shellApp };
  const providers = [
    '@modern-js/ultramodern-app-tools',
    '@modern-js/app-tools-extensions',
    '@modern-js/runtime-renderer-extensions',
    '@modern-js/i18n-integration',
    '@modern-js/federation-runtime',
    '@modern-js/boundary-debugger',
    '@modern-js/plugin-bff-extensions',
  ];
  const packages = providers.map(sourceName => ({
    sourceName,
    targetName: sourceName,
    version: source.modernPackageVersion,
  }));
  const manifest: Record<string, any> = {
    dependencies: {
      '@modern-js/plugin-bff': '3.9.0-ultramodern.3',
      consumer: 'keep',
    },
  };
  const original = structuredClone(manifest);
  assert.throws(
    () => updateModernDependencies(manifest, source, { packages }, { app }),
    /plugin-bff-build-extensions is absent from the authenticated target cohort/u,
  );
  assert.deepEqual(manifest, original);
  packages.push({
    sourceName: '@modern-js/plugin-bff-build-extensions',
    targetName: '@modern-js/plugin-bff-build-extensions',
    version: source.modernPackageVersion,
  });
  assert.equal(
    updateModernDependencies(manifest, source, { packages }, { app }),
    true,
  );
  assert.equal(
    manifest.devDependencies['@modern-js/plugin-bff-build-extensions'],
    source.modernPackageVersion,
  );
  assert.equal(
    manifest.dependencies['@modern-js/plugin-bff'],
    source.modernPackageVersion,
  );
  assert.equal(manifest.dependencies.consumer, 'keep');
  assert.equal(
    updateModernDependencies(manifest, source, { packages }, { app }),
    false,
  );

  const shared = {
    dependencies: { '@modern-js/plugin-bff': '3.9.0-ultramodern.3' },
  };
  assert.equal(updateModernDependencies(shared, source, { packages }), true);
  assert.deepEqual(shared, {
    dependencies: { '@modern-js/plugin-bff': source.modernPackageVersion },
  });
});

test('historical roots authenticate the required native peer before adopting its alias', () => {
  const source = {
    strategy: 'install' as const,
    modernPackageVersion: '3.9.0-ultramodern.5',
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  const provider = '@modern-js/app-tools';
  const packages = [
    provider,
    '@modern-js/runtime-renderer-extensions',
    '@modern-js/plugin-bff-build-extensions',
    '@modern-js/plugin-bff-extensions',
  ].map(sourceName => ({
    sourceName,
    targetName: sourceName.replace('@modern-js/', '@bleedingdev/modern-js-'),
    version: source.modernPackageVersion,
  }));
  const original = {
    modernjs: { workspace: 'ultramodern-superapp', consumer: 'keep' },
    devDependencies: {
      '@modern-js/plugin-bff':
        'npm:@bleedingdev/modern-js-plugin-bff@3.8.2-ultramodern.12',
      'consumer-tool': '^2.0.0',
    },
    dependencies: { consumer: '^1.0.0' },
    scripts: { custom: 'consumer --keep' },
    pnpm: { overrides: { consumer: '^1.0.0' } },
  };
  for (const rejected of [
    packages.filter(item => item.sourceName !== provider),
    packages.map(item =>
      item.sourceName === provider
        ? { ...item, version: '3.8.2-ultramodern.12' }
        : item,
    ),
  ]) {
    const manifest = structuredClone(original);
    assert.throws(
      () => updateModernDependencies(manifest, source, { packages: rejected }),
      /app-tools is absent from the authenticated target cohort/u,
    );
    assert.deepEqual(manifest, original);
  }
  const manifest: Record<string, any> = structuredClone(original);
  assert.equal(updateModernDependencies(manifest, source, { packages }), true);
  assert.equal(
    manifest.devDependencies[provider],
    'npm:@bleedingdev/modern-js-app-tools@3.9.0-ultramodern.5',
  );
  assert.equal(
    manifest.devDependencies['consumer-tool'],
    original.devDependencies['consumer-tool'],
  );
  for (const field of ['modernjs', 'dependencies', 'scripts', 'pnpm'] as const)
    assert.deepEqual(manifest[field], original[field]);
  assert.equal(updateModernDependencies(manifest, source, { packages }), false);
  const unrelated = { devDependencies: { 'consumer-tool': '^2.0.0' } };
  assert.equal(
    updateModernDependencies(unrelated, source, { packages }),
    false,
  );
  assert.deepEqual(unrelated, {
    devDependencies: { 'consumer-tool': '^2.0.0' },
  });
});

test('same-contract BFF cohort updates only declared dependencies and never adopts the build plugin', () => {
  const source = cohort('3.9.0-ultramodern.3');
  const target = cohort('3.9.0-ultramodern.4');
  for (const item of [source, target]) {
    item.packages.push({
      sourceName: '@modern-js/plugin-bff',
      targetName: '@bleedingdev/modern-js-plugin-bff',
      version: item.release.version,
    });
    item.aliases['@modern-js/plugin-bff'] = '@bleedingdev/modern-js-plugin-bff';
  }
  target.packages.push({
    sourceName: '@modern-js/plugin-bff-build-extensions',
    targetName: '@bleedingdev/modern-js-plugin-bff-build-extensions',
    version: target.release.version,
  });
  target.aliases['@modern-js/plugin-bff-build-extensions'] =
    '@bleedingdev/modern-js-plugin-bff-build-extensions';
  target.packages.push({
    sourceName: '@modern-js/app-tools',
    targetName: '@bleedingdev/modern-js-app-tools',
    version: target.release.version,
  });
  target.aliases['@modern-js/app-tools'] = '@bleedingdev/modern-js-app-tools';
  const manifest = {
    modernjs: { workspace: 'ultramodern-superapp' },
    dependencies: {
      '@modern-js/plugin-bff':
        'npm:@bleedingdev/modern-js-plugin-bff@3.9.0-ultramodern.3',
    },
  };
  assert.deepEqual(updateSameContractDependencies(manifest, source, target), [
    {
      section: 'dependencies',
      name: '@modern-js/plugin-bff',
      value: 'npm:@bleedingdev/modern-js-plugin-bff@3.9.0-ultramodern.4',
    },
  ]);
  assert.deepEqual(manifest, {
    modernjs: { workspace: 'ultramodern-superapp' },
    dependencies: {
      '@modern-js/plugin-bff':
        'npm:@bleedingdev/modern-js-plugin-bff@3.9.0-ultramodern.4',
    },
  });
});

test('i18n descriptor adoption authenticates the target and preserves native packages and consumer selections', () => {
  const source = {
    strategy: 'install' as const,
    modernPackageVersion: '3.9.0-ultramodern.4',
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  const integration = '@modern-js/i18n-integration';
  const packages = [
    '@modern-js/ultramodern-app-tools',
    '@modern-js/app-tools-extensions',
    '@modern-js/runtime-renderer-extensions',
    '@modern-js/federation-runtime',
    '@modern-js/boundary-debugger',
    '@modern-js/plugin-bff-extensions',
    integration,
  ].map(sourceName => ({
    sourceName,
    targetName: sourceName.replace('@modern-js/', '@bleedingdev/modern-js-'),
    version: source.modernPackageVersion,
  }));
  const manifest: Record<string, any> = {
    dependencies: {
      '@modern-js/plugin-i18n': '3.8.2',
      i18next: 'consumer-version',
    },
    scripts: { custom: 'consumer-script' },
  };
  for (const rejected of [
    packages.filter(item => item.sourceName !== integration),
    packages.map(item =>
      item.sourceName === integration ? { ...item, version: '3.8.2' } : item,
    ),
  ]) {
    const original = structuredClone(manifest);
    assert.throws(
      () =>
        updateModernDependencies(
          manifest,
          source,
          { packages: rejected },
          { app: shellApp },
        ),
      /i18n-integration is absent from the authenticated target cohort/u,
    );
    assert.deepEqual(manifest, original);
  }
  assert.equal(
    updateModernDependencies(manifest, source, { packages }, { app: shellApp }),
    true,
  );
  assert.equal(
    manifest.dependencies[integration],
    'npm:@bleedingdev/modern-js-i18n-integration@3.9.0-ultramodern.4',
  );
  assert.equal(
    manifest.dependencies['@modern-js/plugin-i18n'],
    'npm:@bleedingdev/modern-js-plugin-i18n@3.9.0-ultramodern.4',
  );
  assert.equal(manifest.dependencies.i18next, 'consumer-version');
  assert.deepEqual(manifest.scripts, { custom: 'consumer-script' });
  assert.equal(
    updateModernDependencies(manifest, source, { packages }, { app: shellApp }),
    false,
  );
  const unrelated = { dependencies: { i18next: 'consumer-version' } };
  assert.equal(
    updateModernDependencies(unrelated, source, { packages }),
    false,
  );
  assert.deepEqual(unrelated, {
    dependencies: { i18next: 'consumer-version' },
  });
});

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { yaml } from '@modern-js/utils';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { updateGeneratedPnpmWorkspacePolicy } from '../src/ultramodern-tooling/commands/migrate-strict-effect/pnpm-policy';
import { runWorkspaceTransaction } from '../src/ultramodern-workspace/add-vertical/transaction';
import {
  createWorkspace,
  linkWorkspaceFormatterDependencies,
  snapshotWorkspace,
} from './helpers/workspace-kit';

test('release-age YAML edits touch only authenticated sequence scalar values', () => {
  const source = cohort('3.9.0-ultramodern.5');
  const target = cohort('3.9.0-ultramodern.6');
  const selector = '@bleedingdev/modern-js-runtime@3.9.0-ultramodern.5';
  const input = `# ${selector}\r\nminimumReleaseAgeExclude: ["${selector}", 'consumer@1.2.3'] # keep\r\nconsumer: '${selector}'\r\n`;
  const expected = input.replace(
    `"${selector}"`,
    '"@bleedingdev/modern-js-runtime@3.9.0-ultramodern.6"',
  );
  assert.equal(replaceReleaseAgeSelectors(input, source, target), expected);
  assert.equal(replaceReleaseAgeSelectors(expected, target, target), expected);
  for (const invalid of [
    `minimumReleaseAgeExclude: ['consumer@1.2.3']`,
    `minimumReleaseAgeExclude: ['${selector}', '${selector}']`,
    `shared: &selectors ['${selector}']\nminimumReleaseAgeExclude: *selectors`,
    `minimumReleaseAgeExclude: [&selector '${selector}']\nconsumer: *selector`,
  ])
    assert.throws(
      () => replaceReleaseAgeSelectors(invalid, source, target),
      /Release-age/,
    );
});

test.each([
  false,
  true,
])('native same-contract classifier accepts only exact cohort policy advancement and repeats without writes with consumer formatting %s', consumerFormatting => {
  const { tempRoot, workspaceDir } = createWorkspace('cohort-policy');
  try {
    const validatorPath = path.join(
      workspaceDir,
      'scripts/validate-ultramodern-workspace.mts',
    );
    linkWorkspaceFormatterDependencies(workspaceDir);
    if (consumerFormatting) {
      const fixture = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, 'fixtures/migration-runtime-historical-4.json'),
          'utf8',
        ),
      ) as { files: Array<{ path: string; content: string }> };
      const formatter = fixture.files.find(
        file => file.path === 'oxfmt.config.ts',
      )!;
      fs.writeFileSync(
        path.join(workspaceDir, formatter.path),
        formatter.content,
      );
    }
    const nativePaths = Object.keys(snapshotWorkspace(workspaceDir)).filter(
      file =>
        file === 'scripts/validate-ultramodern-workspace.mts' ||
        file.endsWith('/shared/ultramodern-build.ts'),
    );
    const formatted = spawnSync(
      process.execPath,
      [
        path.resolve(__dirname, '../node_modules/oxfmt/bin/oxfmt'),
        '--write',
        ...nativePaths,
      ],
      { cwd: workspaceDir, encoding: 'utf8' },
    );
    assert.equal(
      formatted.status,
      0,
      `${formatted.stdout}\n${formatted.stderr}`,
    );

    const source = cohort('3.9.0-ultramodern.5');
    const target = cohort('3.9.0-ultramodern.6');
    const packageSource = {
      strategy: 'install' as const,
      modernPackageVersion: source.release.version,
      aliasScope: 'bleedingdev',
      aliasPackageNamePrefix: 'modern-js-',
    };
    const compactPath = path.join(workspaceDir, '.modernjs/ultramodern.json');
    const raw = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
    raw.packageSource = packageSource;
    fs.writeFileSync(compactPath, JSON.stringify(raw, null, 2) + '\n');
    const rootPath = path.join(workspaceDir, 'package.json');
    const root = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
    root.modernjs.packageSource = {
      strategy: 'install',
      config: './.modernjs/ultramodern.json',
    };
    fs.writeFileSync(rootPath, JSON.stringify(root, null, 2) + '\n');
    fs.writeFileSync(
      path.join(workspaceDir, '.modernjs/release-cohort.json'),
      JSON.stringify(source, null, 2) + '\n',
    );
    for (const [relative, content] of Object.entries(
      snapshotWorkspace(workspaceDir),
    )) {
      if (!relative.endsWith('package.json')) continue;
      const manifest = JSON.parse(content);
      for (const section of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        if (manifest[section]?.['@modern-js/runtime']) {
          manifest[section]['@modern-js/runtime'] =
            `npm:@bleedingdev/modern-js-runtime@${source.release.version}`;
        }
      }
      fs.writeFileSync(
        path.join(workspaceDir, relative),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    }
    updateGeneratedPnpmWorkspacePolicy(
      createMigrationIo(workspaceDir, false),
      packageSource,
      { releaseCohort: source },
    );
    const policyPath = path.join(workspaceDir, 'pnpm-workspace.yaml');
    const originalPolicy = fs.readFileSync(policyPath, 'utf8');
    const comment =
      '# authored policy comment: @bleedingdev/modern-js-runtime@3.9.0-ultramodern.5\r\n';
    fs.writeFileSync(
      policyPath,
      comment + originalPolicy.replaceAll('\n', '\r\n'),
    );
    const before = snapshotWorkspace(workspaceDir);
    const prepareStaged = (installedSource: typeof source) =>
      runWorkspaceTransaction(workspaceDir, stage => {
        assert.notEqual(stage, workspaceDir);
        assert.equal(fs.existsSync(path.join(stage, 'node_modules')), false);
        assert.equal(
          fs.readFileSync(path.join(stage, 'oxfmt.config.ts'), 'utf8'),
          fs.readFileSync(path.join(workspaceDir, 'oxfmt.config.ts'), 'utf8'),
        );
        return prepareSameContractUpdate(
          createMigrationIo(stage, false, workspaceDir),
          JSON.parse(
            fs.readFileSync(
              path.join(stage, '.modernjs/ultramodern.json'),
              'utf8',
            ),
          ),
          { ...packageSource, modernPackageVersion: target.release.version },
          target,
          installedSource,
        );
      });
    const plan = prepareStaged(source);
    assert.equal(plan.classification, 'same-contract', plan.reason);
    assert.deepEqual(snapshotWorkspace(workspaceDir), before);
    const write = plan.writes.find(item => item.path === 'pnpm-workspace.yaml');
    assert.ok(write);
    assert.deepEqual(write.pointers, ['/minimumReleaseAgeExclude']);
    assert.equal(
      write.content,
      comment +
        originalPolicy
          .replace(
            '@bleedingdev/modern-js-runtime@3.9.0-ultramodern.5',
            '@bleedingdev/modern-js-runtime@3.9.0-ultramodern.6',
          )
          .replaceAll('\n', '\r\n'),
    );
    assert.ok(
      plan.writes.every(item => !/\.(?:[cm]?[jt]sx?)$/.test(item.path)),
    );
    const alteredPolicy = yaml.load(before['pnpm-workspace.yaml']) as Record<
      string,
      unknown
    >;
    delete alteredPolicy.trustPolicy;
    fs.writeFileSync(policyPath, yaml.dump(alteredPolicy));
    const incompatible = prepareSameContractUpdate(
      createMigrationIo(workspaceDir, true),
      raw,
      { ...packageSource, modernPackageVersion: target.release.version },
      target,
      source,
    );
    assert.equal(incompatible.classification, 'historical-migration');
    fs.writeFileSync(policyPath, before['pnpm-workspace.yaml']);
    assert.throws(
      () =>
        prepareSameContractUpdate(
          createMigrationIo(workspaceDir, true),
          raw,
          { ...packageSource, modernPackageVersion: target.release.version },
          target,
          target,
        ),
      /installed source cohort/,
    );
    for (const item of plan.writes)
      fs.writeFileSync(path.join(workspaceDir, item.path), item.content);
    const repeated = prepareStaged(target);
    assert.equal(repeated.classification, 'same-contract', repeated.reason);
    assert.deepEqual(repeated.writes, []);
    const authoredValidator =
      fs.readFileSync(validatorPath, 'utf8') +
      "\nexport const consumerValidationPolicy = 'keep';\n";
    fs.writeFileSync(validatorPath, authoredValidator);
    const authoredBefore = snapshotWorkspace(workspaceDir);
    const authoredPlan = prepareStaged(target);
    assert.equal(authoredPlan.classification, 'historical-migration');
    assert.match(authoredPlan.reason, /validator/);
    assert.deepEqual(snapshotWorkspace(workspaceDir), authoredBefore);
    const file = (content: string) => ({
      content: Buffer.from(content),
      mode: 0o644,
    });
    assert.throws(
      () =>
        assertSameContractDelta(plan, [
          {
            relativePath: 'pnpm-workspace.yaml',
            before: file(before['pnpm-workspace.yaml']),
            after: file(write.content + 'trustPolicy: off\n'),
          },
        ]),
      /unapproved change/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
