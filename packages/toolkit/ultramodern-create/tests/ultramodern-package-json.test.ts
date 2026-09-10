import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { UltramodernBridgeConfig } from '../src/ultramodern-workspace/bridge-config';
import {
  createShellHost,
  createVerticalDescriptor,
  shellApp,
} from '../src/ultramodern-workspace/descriptors';
import {
  appDependencies,
  createAppPackage,
  createRootPackageJson,
} from '../src/ultramodern-workspace/package-json';
import { resolveWorkspacePackageLinkingPolicy } from '../src/ultramodern-workspace/package-source';
import type {
  JsonValue,
  ResolvedPackageSource,
  WorkspaceApp,
} from '../src/ultramodern-workspace/types';
import { MINIFLARE_VERSION } from '../src/ultramodern-workspace/versions';

const scope = 'tractor-store';
const packageVersion = '3.5.0-ultramodern.9';

const installPackageSource = {
  strategy: 'install',
  modernPackageVersion: packageVersion,
} satisfies ResolvedPackageSource;

const workspacePackageSource = {
  strategy: 'workspace',
  modernPackageVersion: '0.0.0',
} satisfies ResolvedPackageSource;

const bridgeConfig = {
  enabled: true,
  parentRoot: '../tractor-store',
  workspacePackages: [{ pattern: '../tractor-store/packages/*' }],
  dependencies: ['@tractor-store/bridge-kit'],
  lockfilePolicy: 'parent',
  gates: [{ name: 'contracts', command: 'pnpm test' }],
  reactSingletons: [],
} satisfies UltramodernBridgeConfig;

const installAppDependencies = {
  '@modern-js/plugin-tanstack': packageVersion,
  '@modern-js/plugin-i18n': packageVersion,
  '@modern-js/i18n-integration': packageVersion,
  '@modern-js/runtime': packageVersion,
  '@modern-js/runtime-extensions': packageVersion,
  '@modern-js/runtime-renderer-extensions': packageVersion,
  '@modern-js/federation-runtime': packageVersion,
  '@module-federation/bridge-react': '2.9.0',
  '@module-federation/modern-js-v3': '2.9.0',
  '@module-federation/runtime': '2.9.0',
  '@tanstack/react-router': '1.170.33',
  i18next: '26.4.2',
  'node-fetch': '^3.3.2',
  '@tractor-store/shared-contracts': 'workspace:*',
  '@tractor-store/shared-design-tokens': 'workspace:*',
  react: '19.2.8',
  'react-dom': '19.2.8',
};

// plugin-bff declares both as optional peers, so whoever depends on plugin-bff
// carries them at the exact cohort version.
const bffEffectDependencies = {
  '@effect/opentelemetry': '4.0.0-rc.112',
  effect: '4.0.0-rc.112',
};

function createCatalogVertical() {
  return createVerticalDescriptor('catalog', 4101);
}

function createCheckoutVertical() {
  return createVerticalDescriptor('checkout', 4102);
}

function packageRecord(value: JsonValue) {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, JsonValue>;
}

test('app dependencies pin generated framework deps and distinguish shell-only from multi-vertical workspaces', () => {
  const catalog = createCatalogVertical();
  const checkout = createCheckoutVertical();
  const shellHost = createShellHost([catalog, checkout]);

  assert.deepEqual(appDependencies(scope, installPackageSource, shellApp), {
    ...installAppDependencies,
    ...bffEffectDependencies,
    '@modern-js/boundary-debugger': packageVersion,
    '@modern-js/plugin-bff': packageVersion,
    '@modern-js/plugin-bff-extensions': packageVersion,
  });
  assert.deepEqual(
    appDependencies(scope, installPackageSource, shellHost, [
      catalog,
      checkout,
    ]),
    {
      ...installAppDependencies,
      ...bffEffectDependencies,
      '@modern-js/boundary-debugger': packageVersion,
      '@modern-js/plugin-bff': packageVersion,
      '@modern-js/plugin-bff-extensions': packageVersion,
      '@tractor-store/catalog': 'workspace:*',
      '@tractor-store/checkout': 'workspace:*',
    },
  );
});

test('bridge dependencies are added after generated app deps and collisions fail closed', () => {
  const catalog = createCatalogVertical();

  assert.deepEqual(
    appDependencies(scope, installPackageSource, catalog, [], bridgeConfig),
    {
      ...installAppDependencies,
      '@tractor-store/bridge-kit': 'workspace:*',
      ...bffEffectDependencies,
      '@modern-js/bff-effect': packageVersion,
      '@modern-js/plugin-bff': packageVersion,
      '@modern-js/plugin-bff-extensions': packageVersion,
    },
  );
  assert.throws(
    () =>
      appDependencies(scope, installPackageSource, catalog, [], {
        ...bridgeConfig,
        dependencies: ['react'],
      }),
    {
      message:
        'Bridge mode dependency "react" conflicts with generated app dependency.',
    },
  );
});

test('workspace package source uses workspace versions for generated framework deps', () => {
  const packageJson = packageRecord(
    createAppPackage(
      scope,
      createCatalogVertical(),
      workspacePackageSource,
      false,
    ),
  );

  assert.deepEqual(packageJson.dependencies, {
    '@modern-js/plugin-tanstack': 'workspace:*',
    '@modern-js/plugin-i18n': 'workspace:*',
    '@modern-js/i18n-integration': 'workspace:*',
    '@modern-js/runtime': 'workspace:*',
    '@modern-js/runtime-extensions': 'workspace:*',
    '@modern-js/runtime-renderer-extensions': 'workspace:*',
    '@modern-js/federation-runtime': 'workspace:*',
    '@module-federation/bridge-react': '2.9.0',
    '@module-federation/modern-js-v3': '2.9.0',
    '@module-federation/runtime': '2.9.0',
    '@tanstack/react-router': '1.170.33',
    i18next: '26.4.2',
    'node-fetch': '^3.3.2',
    '@tractor-store/shared-contracts': 'workspace:*',
    '@tractor-store/shared-design-tokens': 'workspace:*',
    react: '19.2.8',
    'react-dom': '19.2.8',
    ...bffEffectDependencies,
    '@modern-js/bff-effect': 'workspace:*',
    '@modern-js/plugin-bff': 'workspace:*',
    '@modern-js/plugin-bff-extensions': 'workspace:*',
  });
  assert.equal(packageJson.devDependencies['cross-env'], '10.1.0');
  for (const name of [
    '@modern-js/app-tools',
    '@modern-js/app-tools-extensions',
    '@modern-js/ultramodern-app-tools',
    '@modern-js/plugin-bff-build-extensions',
  ]) {
    assert.equal(packageJson.devDependencies[name], 'workspace:*');
  }
  const scripts = packageRecord(packageJson.scripts);
  assert.match(
    scripts.build as string,
    /(?:^| && )cross-env MODERNJS_DEPLOY=node modern deploy --skip-build(?: && |$)/u,
  );
  assert.match(
    scripts['cloudflare:build'] as string,
    /(?:^| && )cross-env MODERNJS_DEPLOY=cloudflare modern build(?: && |$)/u,
  );
  assert.match(
    scripts['cloudflare:build'] as string,
    /(?:^| && )cross-env MODERNJS_DEPLOY=cloudflare modern deploy --skip-build(?: && |$)/u,
  );
  assert.equal(
    scripts['cloudflare:deploy'],
    'cross-env ULTRAMODERN_CLOUDFLARE_REQUIRE_PUBLIC_URLS=true pnpm run cloudflare:build && wrangler deploy --config .output/wrangler.json',
  );
  for (const command of Object.values(scripts)) {
    assert.doesNotMatch(
      command as string,
      /(?:^| && )(?:MODERNJS_DEPLOY|ULTRAMODERN_CLOUDFLARE_REQUIRE_PUBLIC_URLS)=/u,
    );
  }
});

test('workspace package source isolates linked framework dependencies without changing install-backed workspaces', () => {
  assert.deepEqual(
    resolveWorkspacePackageLinkingPolicy({ strategy: 'workspace' }),
    {
      injectWorkspacePackages: true,
      linkWorkspacePackages: true,
    },
  );
  assert.deepEqual(
    resolveWorkspacePackageLinkingPolicy({ strategy: 'install' }),
    {},
  );
});

test('root package json pins workspace package versions and bridge workspace globs', () => {
  const catalog = createCatalogVertical();
  const checkout = createCheckoutVertical();
  const rootPackageJson = packageRecord(
    createRootPackageJson(
      scope,
      installPackageSource,
      [catalog, checkout],
      bridgeConfig,
    ),
  );

  assert.deepEqual(rootPackageJson.workspaces, [
    'apps/*',
    'verticals/*',
    'packages/*',
    '../tractor-store/packages/*',
  ]);
  const rootScripts = packageRecord(rootPackageJson.scripts);
  assert.equal(rootScripts.format, 'oxfmt .');
  assert.equal(rootScripts['format:check'], 'oxfmt --check .');
  assert.equal(
    rootScripts.postinstall,
    'node ./scripts/bootstrap-agent-skills.mts --postinstall',
  );
  assert.deepEqual(rootPackageJson.devDependencies, {
    '@types/node': '^26.4.1',
    '@effect/tsgo': '0.41.0',
    '@modern-js/code-tools': packageVersion,
    '@modern-js/app-tools-extensions': packageVersion,
    '@modern-js/ultramodern-app-tools': packageVersion,
    '@modern-js/runtime-renderer-extensions': packageVersion,
    '@modern-js/ultramodern-create': packageVersion,
    '@modern-js/bff-effect': packageVersion,
    '@modern-js/plugin-bff': packageVersion,
    '@modern-js/plugin-bff-extensions': packageVersion,
    '@modern-js/plugin-bff-build-extensions': packageVersion,
    ...bffEffectDependencies,
    '@typescript/native': 'npm:typescript@7.0.2',
    'cross-env': '10.1.0',
    lefthook: '^2.1.10',
    miniflare: MINIFLARE_VERSION,
    oxlint: '1.81.0',
    oxfmt: '0.66.0',
    ultracite: '7.11.0',
    wrangler: '4.116.0',
    'zephyr-agent': '1.2.4',
  });
});

test('app package generation throws for unknown remote refs', () => {
  const missingRemoteShell = {
    ...shellApp,
    verticalRefs: ['missing'],
  } satisfies WorkspaceApp;

  assert.throws(
    () =>
      createAppPackage(scope, missingRemoteShell, installPackageSource, false, [
        createCatalogVertical(),
      ]),
    {
      message:
        'Unknown remote vertical reference missing for shell-super-app. Available remotes: catalog.',
    },
  );
});

test('generated apps resolve their public renderer entry with isolated direct dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-renderer-direct-'));
  try {
    const app = path.join(root, 'apps/shell');
    const modernScope = path.join(app, 'node_modules/@modern-js');
    fs.mkdirSync(modernScope, { recursive: true });
    const manifest = packageRecord(
      createAppPackage(scope, shellApp, workspacePackageSource, false),
    );
    const dependencies = {
      ...packageRecord(manifest.dependencies),
      ...packageRecord(manifest.devDependencies),
    };
    const packages = {
      '@modern-js/ultramodern-app-tools':
        '../../solutions/ultramodern-app-tools',
      '@modern-js/runtime-renderer-extensions':
        '../../runtime/renderer-extensions',
    };
    // Link only declared app dependencies, without a hoisted root node_modules.
    for (const [name, directory] of Object.entries(packages)) {
      if (!Object.hasOwn(dependencies, name)) continue;
      fs.symlinkSync(
        path.resolve(__dirname, '..', directory),
        path.join(modernScope, name.split('/')[1]),
        'dir',
      );
    }
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=commonjs',
        '-e',
        `const { createRequire } = require('node:module');
const appRequire = createRequire(process.argv[1]);
appRequire.resolve('@modern-js/ultramodern-app-tools');
process.stdout.write(appRequire.resolve('@modern-js/runtime-renderer-extensions'));`,
        path.join(app, '.modern-js/main/runtime.js'),
      ],
      { cwd: app, env: { ...process.env, NODE_PATH: '' }, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /renderer-extensions/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('BFF build dependencies follow app capabilities and retain runtime packages', () => {
  for (const preset of ['full-stack', 'api-only', 'ui-only'] as const) {
    const app = createVerticalDescriptor('catalog', 4101, { preset });
    const manifest = packageRecord(
      createAppPackage(scope, app, installPackageSource, false),
    );
    const expected = preset === 'ui-only' ? undefined : packageVersion;
    assert.equal(
      manifest.devDependencies['@modern-js/plugin-bff-build-extensions'],
      expected,
    );
    assert.equal(manifest.dependencies['@modern-js/plugin-bff'], expected);
    assert.equal(
      manifest.dependencies['@modern-js/plugin-bff-extensions'],
      expected,
    );
  }
});

test('every generated i18n profile directly declares the descriptor provider', () => {
  const apps = [
    shellApp,
    ...(['full-stack', 'api-only', 'ui-only'] as const).map(preset =>
      createVerticalDescriptor('catalog', 4101, { preset }),
    ),
    createVerticalDescriptor('navigation', 4102, { horizontalRemote: true }),
  ];
  const packageSource = {
    ...installPackageSource,
    aliasScope: 'bleedingdev',
    aliasPackageNamePrefix: 'modern-js-',
  };
  for (const app of apps) {
    const manifest = packageRecord(
      createAppPackage(scope, app, packageSource, false),
    );
    assert.equal(
      manifest.dependencies['@modern-js/i18n-integration'],
      `npm:@bleedingdev/modern-js-i18n-integration@${packageVersion}`,
    );
    assert.equal(
      manifest.dependencies['@modern-js/plugin-i18n'],
      `npm:@bleedingdev/modern-js-plugin-i18n@${packageVersion}`,
    );
    assert.equal(
      manifest.dependencies['@modern-js/i18n-runtime-extensions'],
      undefined,
    );
  }
});
