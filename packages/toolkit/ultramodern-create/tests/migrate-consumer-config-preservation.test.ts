import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { format } from 'oxfmt';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { migrateBffBuildPluginImports } from '../src/ultramodern-tooling/commands/migrate-strict-effect/bff-build-plugin-migration';
import { updateGeneratedModernConfigs } from '../src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-modern-configs';
import { updateGeneratedTypeScriptSurfaces } from '../src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-typescript';
import {
  generatedUiSourceRequiresRewrite,
  writeGeneratedUiSourceIfChanged,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/generated-ui-source';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { runValidate } from '../src/ultramodern-tooling/commands/validate';
import {
  allWorkspaceAppsFromToolingConfig,
  readUltramodernConfig,
} from '../src/ultramodern-tooling/config';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
import { createAppRuntimeConfig } from '../src/ultramodern-workspace/app-files';
import {
  createFederatedComponentsRegistry,
  createRemoteExposeFragmentPage,
} from '../src/ultramodern-workspace/demo-components';
import {
  createPackageRoot,
  formatGeneratedSourceCandidates,
} from '../src/ultramodern-workspace/fs-io';
import {
  createAppModernConfig,
  createRemoteModuleFederationConfig,
  createShellModuleFederationConfig,
} from '../src/ultramodern-workspace/module-federation';
import { createAppTsConfig } from '../src/ultramodern-workspace/tsconfigs';
import { createPackagedWorkspaceValidationScript } from '../src/ultramodern-workspace/workspace-scripts';
import { linkWorkspaceFormatterDependencies } from './helpers/workspace-kit';

function readJson(workspaceRoot: string, relativePath: string) {
  return JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf-8'),
  ) as Record<string, any>;
}

function writeJson(
  workspaceRoot: string,
  relativePath: string,
  value: unknown,
) {
  fs.writeFileSync(
    path.join(workspaceRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function captureStdout<T>(run: () => T): { result: T; output: string } {
  const original = process.stdout.write.bind(process.stdout);
  let output = '';
  (process.stdout as NodeJS.WriteStream).write = ((chunk: unknown) => {
    output += typeof chunk === 'string' ? chunk : String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    return { result: run(), output };
  } finally {
    process.stdout.write = original;
  }
}

function snapshotWorkspace(directory: string, root = directory) {
  const snapshot = new Map<string, Buffer>();
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .toSorted((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, entryPath);
    if (entry.isDirectory()) {
      for (const [nestedPath, content] of snapshotWorkspace(entryPath, root)) {
        snapshot.set(nestedPath, content);
      }
    } else if (entry.isSymbolicLink()) {
      snapshot.set(
        relativePath,
        Buffer.from(`symlink:${fs.readlinkSync(entryPath)}`),
      );
    } else {
      snapshot.set(relativePath, fs.readFileSync(entryPath));
    }
  }
  return snapshot;
}

function removeTsCheckerBuildOverride(source: string) {
  return source.replace(
    `        tsChecker: {
          typescript: {
            build: false,
          },
        },
`,
    '',
  );
}

function removeReleaseEnvelopePlugin(source: string) {
  return source
    .replace(/\bultramodernReleaseEnvelopePlugin,\s*/gu, '')
    .replace(/,\s*ultramodernReleaseEnvelopePlugin(?=\s*\})/gu, '')
    .replace(/^\s*ultramodernReleaseEnvelopePlugin\(\),?\r?\n/gmu, '');
}

function previousCompositionSource(source: string) {
  return source
    .replace(
      /import\s*\{[^}]*\bultramodernAppTools\b[^}]*\}\s*from\s*['"]@modern-js\/ultramodern-app-tools['"];?\s*/u,
      '',
    )
    .replace(
      /import\s*\{\s*defineConfig\s*\}\s*from\s*['"]@modern-js\/app-tools['"];?/u,
      "import { appTools, defineConfig, presetUltramodern, ultramodernReleaseEnvelopePlugin } from '@modern-js/app-tools';",
    )
    .replace(
      'ultramodernAppTools()',
      'appTools(),\n        ultramodernReleaseEnvelopePlugin()',
    )
    .replaceAll(
      '@modern-js/app-tools-extensions/config',
      '@modern-js/app-tools/config',
    );
}

function addLegacyGeneratedDefaults(source: string) {
  const serverAnchor = "        publicDir: ['./locales', './assets'],\n";
  const withLegacySsr = source.replace(
    serverAnchor,
    `${serverAnchor}        ssr: {
          mode: 'stream',
          moduleFederationAppSSR: true,
        },
`,
  );
  assert.notEqual(withLegacySsr, source);

  const composeEndIndex = withLegacySsr.lastIndexOf('\n  )');
  assert.notEqual(composeEndIndex, -1);
  const optionsEndIndex =
    withLegacySsr.lastIndexOf('\n    }', composeEndIndex) + 1;
  assert.notEqual(optionsEndIndex, 0);
  return `${withLegacySsr.slice(0, optionsEndIndex)}      enableBffRequestId: true,
      enableModuleFederationSSR: true,
      enableTelemetryExporters: true,
      telemetryFailLoudStartup: false,
${withLegacySsr.slice(optionsEndIndex)}`;
}

test('migration replaces recognized historical validator with the native tooling entry point', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-validator-refresh-'),
  );
  const workspaceRoot = path.join(tempRoot, 'workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'workspace',
      modernVersion: '3.2.1',
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    const validatorPath = path.join(
      workspaceRoot,
      'scripts/validate-ultramodern-workspace.mts',
    );
    const nativeSource = fs.readFileSync(validatorPath, 'utf8');
    const source = createPackagedWorkspaceValidationScript(
      'workspace',
      false,
      [],
    );
    const stale = source.replace(
      /"?schemaVersion"?: 2/u,
      '"schemaVersion": -123',
    );
    assert.notEqual(stale, source);
    fs.writeFileSync(validatorPath, stale);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    const migrated = fs.readFileSync(validatorPath, 'utf8');
    assert.doesNotMatch(migrated, /schemaVersion: -123/u);
    assert.equal(migrated, nativeSource);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migration fills historical deployment metadata and validates authored business proofs', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-deploy-migration-'),
  );
  const workspaceRoot = path.join(tempRoot, 'workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'workspace',
      modernVersion: '3.2.1',
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    addUltramodernVertical({
      workspaceRoot,
      name: 'catalog',
      modernVersion: '3.2.1',
    });
    const compact = readJson(workspaceRoot, '.modernjs/ultramodern.json');
    const businessProof = {
      distributedSsrProofRoutes: ['/en', '/en/catalog/custom-sku'],
      jsonSmokeChecks: [
        {
          id: 'catalog-domain',
          route: '/catalog-api/catalog/custom-sku',
          expect: { sku: 'custom-sku' },
        },
      ],
    };
    for (const app of compact.topology.apps) {
      if (app.kind === 'shell') app.deploy = { cloudflare: businessProof };
      else delete app.deploy;
    }
    writeJson(workspaceRoot, '.modernjs/ultramodern.json', compact);
    expect(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
    ).toBe(0);
    const migrated = readJson(workspaceRoot, '.modernjs/ultramodern.json');
    for (const app of migrated.topology.apps) {
      expect(app.deploy.cloudflare.assetsBinding).toBe('ASSETS');
      if (app.kind === 'shell')
        expect(app.deploy.cloudflare).toMatchObject(businessProof);
    }
    expect(runValidate({ workspaceRoot, invocationCwd: workspaceRoot })).toBe(
      0,
    );
    migrated.topology.apps[0].moduleFederation.ssr = false;
    writeJson(workspaceRoot, '.modernjs/ultramodern.json', migrated);
    expect(
      runValidate({ workspaceRoot, invocationCwd: workspaceRoot }),
    ).not.toBe(0);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate converges the published .15 generated Tailwind config to native defaults', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-generated-config-'),
  );
  const workspaceRoot = path.join(tempRoot, 'generated-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'generated-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    const modernConfigPath = path.join(
      workspaceRoot,
      'apps/shell-super-app/modern.config.ts',
    );
    const currentGeneratedConfig = fs.readFileSync(modernConfigPath, 'utf-8');
    assert.match(
      currentGeneratedConfig,
      /tsChecker:\s*\{\s*typescript:\s*\{\s*build: false,/u,
    );
    const predecessorGeneratedConfig = removeTsCheckerBuildOverride(
      currentGeneratedConfig.replace(
        'pluginTailwindcss()',
        'pluginTailwindcss({ optimize: false })',
      ),
    );
    assert.notEqual(predecessorGeneratedConfig, currentGeneratedConfig);
    assert.doesNotMatch(predecessorGeneratedConfig, /tsChecker/u);
    fs.writeFileSync(
      modernConfigPath,
      addLegacyGeneratedDefaults(predecessorGeneratedConfig),
      'utf-8',
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(modernConfigPath, 'utf-8'),
      currentGeneratedConfig,
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(modernConfigPath, 'utf-8'),
      currentGeneratedConfig,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate composes the previous generated app-tools and release-envelope plugins natively', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-release-envelope-'),
  );
  const workspaceRoot = path.join(tempRoot, 'generated-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'generated-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    const modernConfigPath = path.join(
      workspaceRoot,
      'apps/shell-super-app/modern.config.ts',
    );
    const currentGeneratedConfig = fs.readFileSync(modernConfigPath, 'utf-8');
    const predecessorGeneratedConfig = removeReleaseEnvelopePlugin(
      previousCompositionSource(currentGeneratedConfig),
    );
    assert.notEqual(predecessorGeneratedConfig, currentGeneratedConfig);
    assert.doesNotMatch(
      predecessorGeneratedConfig,
      /ultramodernReleaseEnvelopePlugin/u,
    );
    fs.writeFileSync(modernConfigPath, predecessorGeneratedConfig, 'utf-8');

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(modernConfigPath, 'utf-8'),
      currentGeneratedConfig,
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(modernConfigPath, 'utf-8'),
      currentGeneratedConfig,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate preserves an unmarked consumer Modern config while updating generated bridge ownership', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-consumer-config-'),
  );
  const workspaceRoot = path.join(tempRoot, 'consumer-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'consumer-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);

    const modernConfigPath = path.join(
      workspaceRoot,
      'apps/shell-super-app/modern.config.ts',
    );
    const generatedModernConfig = fs.readFileSync(modernConfigPath, 'utf-8');
    const predecessorGeneratedConfig = removeTsCheckerBuildOverride(
      generatedModernConfig.replace(
        'pluginTailwindcss()',
        'pluginTailwindcss({ optimize: false })',
      ),
    );
    assert.notEqual(predecessorGeneratedConfig, generatedModernConfig);
    assert.doesNotMatch(predecessorGeneratedConfig, /tsChecker/u);
    const consumerModernConfig = predecessorGeneratedConfig
      .replace(
        "import { i18nPlugin } from '@modern-js/plugin-i18n';",
        `import { bffPlugin } from '@modern-js/plugin-bff';
import { i18nPlugin } from '@modern-js/plugin-i18n';`,
      )
      .replace(
        'const cloudflareDeployEnabled =',
        `export const presentationAccessPolicy = {
  studioHost: '127.0.0.1',
  validateManifest: true,
} as const;

const productEffectBffPlugin = bffPlugin();

const cloudflareDeployEnabled =`,
      )
      .replace(
        '      builderPlugins:',
        `      bff: {
        effect: {
          entry: './api/product-effect',
          strictEffectApproach: true,
        },
        prefix: '/api/product',
        runtimeFramework: 'effect',
      },
      builderPlugins:`,
      )
      .replace(
        '        appTools(),',
        `        appTools(),
        productEffectBffPlugin,`,
      );
    fs.writeFileSync(modernConfigPath, consumerModernConfig, 'utf-8');

    const shellPackagePath = 'apps/shell-super-app/package.json';
    const shellPackage = readJson(workspaceRoot, shellPackagePath);
    shellPackage.dependencies['react-router'] = '8.0.0';
    const consumerDevScript = `pnpm presentation:studio && ${shellPackage.scripts.dev}`;
    const generatedBuildSegments = shellPackage.scripts.build.split(' && ');
    const consumerBuildScript = [
      generatedBuildSegments[0],
      'pnpm product:manifest',
      ...generatedBuildSegments.slice(1),
    ].join(' && ');
    const consumerServeScript =
      'node ./scripts/serve-product-preview.mjs --strict-policy';
    shellPackage.scripts.dev = consumerDevScript;
    shellPackage.scripts.build = consumerBuildScript;
    shellPackage.scripts.serve = consumerServeScript;
    shellPackage.scripts['presentation:studio'] =
      'node ./scripts/presentation-studio.mjs';
    shellPackage.scripts['product:manifest'] =
      'node ./scripts/validate-product-manifest.mjs';
    writeJson(workspaceRoot, shellPackagePath, shellPackage);

    const rootPackage = readJson(workspaceRoot, 'package.json');
    const consumerRootBuildScript = `${rootPackage.scripts.build} && pnpm product:artifacts`;
    rootPackage.scripts.build = consumerRootBuildScript;
    rootPackage.scripts['product:artifacts'] =
      'node ./scripts/validate-product-artifacts.mjs';
    writeJson(workspaceRoot, 'package.json', rootPackage);

    const baseTsConfig = readJson(workspaceRoot, 'tsconfig.base.json');
    const effectPlugin = baseTsConfig.compilerOptions.plugins.find(
      (plugin: Record<string, unknown>) =>
        plugin.name === '@effect/language-service',
    );
    effectPlugin.diagnosticSeverity['effect/floatingEffect'] = 'warning';
    baseTsConfig.compilerOptions.types = ['./types/product-globals'];
    baseTsConfig.compilerOptions.plugins.push({
      name: 'product-typescript-plugin',
      productManifest: './product-manifest.json',
    });
    baseTsConfig.references = [{ path: './packages/product-contracts' }];
    writeJson(workspaceRoot, 'tsconfig.base.json', baseTsConfig);

    const shellTsConfigPath = 'apps/shell-super-app/tsconfig.json';
    const shellTsConfig = readJson(workspaceRoot, shellTsConfigPath);
    shellTsConfig.include.push('presentation/**/*.ts');
    shellTsConfig.references = [
      ...(shellTsConfig.references ?? []),
      { path: '../../packages/product-contracts' },
    ];
    shellTsConfig.compilerOptions.paths = {
      '@product/*': ['./src/product/*'],
    };
    shellTsConfig.productValidation = { manifest: './product-manifest.json' };
    writeJson(workspaceRoot, shellTsConfigPath, shellTsConfig);

    const dryRunProtectedPaths = [
      modernConfigPath,
      path.join(workspaceRoot, 'package.json'),
      path.join(workspaceRoot, shellPackagePath),
      path.join(workspaceRoot, 'tsconfig.base.json'),
      path.join(workspaceRoot, shellTsConfigPath),
    ];
    const beforeDryRun = new Map(
      dryRunProtectedPaths.map(filePath => [
        filePath,
        fs.readFileSync(filePath),
      ]),
    );
    const dryRun = captureStdout(() =>
      runUltramodernToolingCli(
        ['migrate-strict-effect', '--dry-run'],
        workspaceRoot,
      ),
    );
    assert.equal(await dryRun.result, 0);
    assert.match(dryRun.output, /preserved consumer-owned TypeScript/u);
    assert.match(dryRun.output, /mixed consumer\/framework ownership/u);
    assert.match(dryRun.output, /Modern config is consumer-owned/u);
    for (const filePath of dryRunProtectedPaths) {
      assert.deepEqual(fs.readFileSync(filePath), beforeDryRun.get(filePath));
    }

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );

    assert.equal(
      fs.readFileSync(modernConfigPath, 'utf-8'),
      consumerModernConfig.replace(
        "from '@modern-js/plugin-bff';",
        "from '@modern-js/plugin-bff-build-extensions';",
      ),
    );
    const migratedShellPackage = readJson(workspaceRoot, shellPackagePath);
    assert.equal(migratedShellPackage.dependencies['react-router'], undefined);
    assert.equal(migratedShellPackage.scripts.dev, consumerDevScript);
    assert.equal(migratedShellPackage.scripts.build, consumerBuildScript);
    assert.equal(migratedShellPackage.scripts.serve, consumerServeScript);
    assert.equal(
      migratedShellPackage.scripts['presentation:studio'],
      shellPackage.scripts['presentation:studio'],
    );
    assert.equal(
      migratedShellPackage.scripts['product:manifest'],
      shellPackage.scripts['product:manifest'],
    );
    const migratedRootPackage = readJson(workspaceRoot, 'package.json');
    assert.equal(migratedRootPackage.scripts.build, consumerRootBuildScript);
    assert.equal(
      migratedRootPackage.scripts['product:artifacts'],
      rootPackage.scripts['product:artifacts'],
    );
    const migratedBaseTsConfig = readJson(workspaceRoot, 'tsconfig.base.json');
    assert.deepEqual(migratedBaseTsConfig, baseTsConfig);
    assert.deepEqual(migratedBaseTsConfig.references, baseTsConfig.references);
    assert.deepEqual(
      migratedBaseTsConfig.compilerOptions.types,
      baseTsConfig.compilerOptions.types,
    );
    assert.deepEqual(
      migratedBaseTsConfig.compilerOptions.plugins.find(
        (plugin: Record<string, unknown>) =>
          plugin.name === '@effect/language-service',
      ).diagnosticSeverity,
      effectPlugin.diagnosticSeverity,
    );
    assert.deepEqual(
      migratedBaseTsConfig.compilerOptions.plugins.find(
        (plugin: Record<string, unknown>) =>
          plugin.name === 'product-typescript-plugin',
      ),
      baseTsConfig.compilerOptions.plugins[1],
    );
    const migratedShellTsConfig = readJson(workspaceRoot, shellTsConfigPath);
    assert.ok(migratedShellTsConfig.include.includes('presentation/**/*.ts'));
    assert.ok(
      migratedShellTsConfig.references.some(
        (reference: Record<string, unknown>) =>
          reference.path === '../../packages/product-contracts',
      ),
    );
    assert.deepEqual(
      migratedShellTsConfig.compilerOptions.paths,
      shellTsConfig.compilerOptions.paths,
    );
    assert.deepEqual(
      migratedShellTsConfig.productValidation,
      shellTsConfig.productValidation,
    );
    assert.match(
      fs.readFileSync(
        path.join(
          workspaceRoot,
          'apps/shell-super-app/module-federation.config.ts',
        ),
        'utf-8',
      ),
      /enableBridgeRouter:\s*false/u,
    );

    const idempotencePaths = [
      ...dryRunProtectedPaths,
      path.join(
        workspaceRoot,
        'apps/shell-super-app/module-federation.config.ts',
      ),
    ];
    const afterFirstMigration = new Map(
      idempotencePaths.map(filePath => [filePath, fs.readFileSync(filePath)]),
    );
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    for (const filePath of idempotencePaths) {
      assert.deepEqual(
        fs.readFileSync(filePath),
        afterFirstMigration.get(filePath),
        `${path.relative(workspaceRoot, filePath)} was not byte-idempotent`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate refuses a marked ambiguous Module Federation config before writes', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-consumer-conflict-'),
  );
  const workspaceRoot = path.join(tempRoot, 'consumer-conflict-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'consumer-conflict-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    const shellPackagePath = 'apps/shell-super-app/package.json';
    const shellPackage = readJson(workspaceRoot, shellPackagePath);
    shellPackage.dependencies['react-router'] = '8.0.0';
    writeJson(workspaceRoot, shellPackagePath, shellPackage);

    const moduleFederationPath =
      'apps/shell-super-app/module-federation.config.ts';
    fs.writeFileSync(
      path.join(workspaceRoot, moduleFederationPath),
      `// ultramodern-mf: generated
import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

const productFederationPolicy = { name: 'consumer-shell' };

export default createModuleFederationConfig({
  ...productFederationPolicy,
});
`,
    );

    const before = snapshotWorkspace(workspaceRoot);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      1,
    );
    assert.deepEqual(
      snapshotWorkspace(workspaceRoot),
      before,
      'workspace changed despite a marked ambiguous preflight conflict',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate preserves a generator-derived Module Federation config with consumer extensions', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-extended-mf-config-'),
  );
  const workspaceRoot = path.join(tempRoot, 'extended-mf-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'extended-mf-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    const configPath = path.join(
      workspaceRoot,
      'apps/shell-super-app/module-federation.config.ts',
    );
    const generatedSource = fs.readFileSync(configPath, 'utf-8');
    const extendedSource = generatedSource.replace(
      'export default moduleFederationConfig;',
      `export const consumerFederationDiagnostics = {
  owner: 'product-platform',
  validateRemoteManifest: true,
} as const;

export default moduleFederationConfig;`,
    );
    assert.notEqual(extendedSource, generatedSource);
    fs.writeFileSync(configPath, extendedSource);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(fs.readFileSync(configPath, 'utf-8'), extendedSource);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate preserves unproven browser and backend federation configs on surface retirement', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-retired-mf-surface-'),
  );
  const workspaceRoot = path.join(tempRoot, 'retired-mf-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'retired-mf-workspace',
      modernVersion: '3.2.1',
      enableTailwind: false,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    addUltramodernVertical({
      workspaceRoot,
      name: 'headless-orders',
      modernVersion: '3.2.1',
      enableTailwind: false,
      packageSource: { strategy: 'workspace' },
      preset: 'api-only',
    });
    addUltramodernVertical({
      workspaceRoot,
      name: 'storefront',
      modernVersion: '3.2.1',
      enableTailwind: false,
      packageSource: { strategy: 'workspace' },
      preset: 'ui-only',
    });
    addUltramodernVertical({
      workspaceRoot,
      name: 'generated-headless-orders',
      modernVersion: '3.2.1',
      enableTailwind: false,
      packageSource: { strategy: 'workspace' },
      preset: 'full-stack',
    });

    const compactPath = '.modernjs/ultramodern.json';
    const compact = readJson(workspaceRoot, compactPath);
    const generatedHeadlessApp = compact.topology.apps.find(
      (app: Record<string, any>) => app.id === 'generated-headless-orders',
    );
    assert.ok(generatedHeadlessApp);
    generatedHeadlessApp.surfaceProfile = 'api-only';
    writeJson(workspaceRoot, compactPath, compact);

    const browserConfigPath = path.join(
      workspaceRoot,
      'verticals/headless-orders/module-federation.config.ts',
    );
    const generatedBrowserConfigPath = path.join(
      workspaceRoot,
      'verticals/generated-headless-orders/module-federation.config.ts',
    );
    const generatedBrowserConfig = fs.readFileSync(
      generatedBrowserConfigPath,
      'utf-8',
    );
    const backendConfigPath = path.join(
      workspaceRoot,
      'verticals/storefront/backend-federation.config.ts',
    );
    const consumerBrowserConfig = `import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: 'consumer-owned-headless-browser-surface',
  filename: 'consumer-remoteEntry.js',
});
`;
    const consumerBackendConfig = `export default {
  name: 'consumer-owned-storefront-backend-surface',
};
`;
    fs.writeFileSync(browserConfigPath, consumerBrowserConfig);
    fs.writeFileSync(backendConfigPath, consumerBackendConfig);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--dry-run', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(browserConfigPath, 'utf-8'),
      consumerBrowserConfig,
    );
    assert.equal(
      fs.readFileSync(generatedBrowserConfigPath, 'utf-8'),
      generatedBrowserConfig,
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(browserConfigPath, 'utf-8'),
      consumerBrowserConfig,
    );
    assert.equal(fs.existsSync(generatedBrowserConfigPath), false);
    assert.equal(
      fs.readFileSync(backendConfigPath, 'utf-8'),
      consumerBackendConfig,
    );

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assert.equal(
      fs.readFileSync(browserConfigPath, 'utf-8'),
      consumerBrowserConfig,
    );
    assert.equal(fs.existsSync(generatedBrowserConfigPath), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate rolls back earlier writes when a deterministic late write fails', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-late-rollback-'),
  );
  const workspaceRoot = path.join(tempRoot, 'rollback-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'rollback-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    const compactPath = '.modernjs/ultramodern.json';
    const compact = readJson(workspaceRoot, compactPath);
    compact.generator.version = '0.0.0-rollback-proof';
    writeJson(workspaceRoot, compactPath, compact);

    const outsideOxlintPath = path.join(tempRoot, 'outside-oxlint.config.ts');
    fs.writeFileSync(
      outsideOxlintPath,
      `export default {
  extends: [core, react],
};
`,
    );
    const oxlintPath = path.join(workspaceRoot, 'oxlint.config.ts');
    fs.rmSync(oxlintPath);
    fs.symlinkSync(outsideOxlintPath, oxlintPath);

    const before = snapshotWorkspace(workspaceRoot);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      1,
    );
    assert.deepEqual(snapshotWorkspace(workspaceRoot), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate preserves consumer Drizzle versions without materializing an unrelated patch', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-consumer-drizzle-'),
  );
  const workspaceRoot = path.join(tempRoot, 'consumer-drizzle-workspace');

  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'consumer-drizzle-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    addUltramodernVertical({
      workspaceRoot,
      name: 'orders',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    const ordersPackagePath = 'verticals/orders/package.json';
    const ordersPackage = readJson(workspaceRoot, ordersPackagePath);
    ordersPackage.dependencies['drizzle-orm'] = '0.45.2';
    ordersPackage.devDependencies['drizzle-kit'] = '0.31.10';
    writeJson(workspaceRoot, ordersPackagePath, ordersPackage);

    const workspacePolicyPath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
    // Historical framework patches do not establish ownership of every later
    // consumer patch for the same package (OntOS uses both of these repairs).
    const consumerPatches = {
      'effect@4.0.0-rc.112': 'patches/consumer-effect-declarations.patch',
      'drizzle-orm@0.45.2': 'patches/consumer-drizzle-declarations.patch',
    };
    const policySource = fs.readFileSync(workspacePolicyPath, 'utf8');
    fs.writeFileSync(
      workspacePolicyPath,
      policySource.replace(
        'patchedDependencies:\n',
        `patchedDependencies:\n${Object.entries(consumerPatches)
          .map(([selector, patchPath]) => `  '${selector}': ${patchPath}\n`)
          .join('')}`,
      ),
    );
    for (const patchPath of Object.values(consumerPatches)) {
      fs.writeFileSync(
        path.join(workspaceRoot, patchPath),
        'consumer repair\n',
      );
    }
    const beforePolicy = fs.readFileSync(workspacePolicyPath);
    const drizzlePatchPath = path.join(
      workspaceRoot,
      'patches/drizzle-orm-ts7-strict-declarations.patch',
    );
    fs.rmSync(drizzlePatchPath, { force: true });
    assert.equal(fs.existsSync(drizzlePatchPath), false);

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );

    const migratedOrdersPackage = readJson(workspaceRoot, ordersPackagePath);
    assert.equal(migratedOrdersPackage.dependencies['drizzle-orm'], '0.45.2');
    assert.equal(
      migratedOrdersPackage.devDependencies['drizzle-kit'],
      '0.31.10',
    );
    assert.deepEqual(fs.readFileSync(workspacePolicyPath), beforePolicy);
    for (const patchPath of Object.values(consumerPatches)) {
      assert.equal(
        fs.readFileSync(path.join(workspaceRoot, patchPath), 'utf8'),
        'consumer repair\n',
      );
    }
    assert.equal(fs.existsSync(drizzlePatchPath), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migration preserves authored tooling, deployment topology, and federation composition', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-consumer-artifacts-'),
  );
  const workspaceRoot = path.join(tempRoot, 'workspace');
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'consumer-artifacts',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(workspaceRoot);
    addUltramodernVertical({
      workspaceRoot,
      name: 'orders',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    const authoredFiles = {
      'apps/shell-super-app/src/modern-app-env.d.ts':
        "/// <reference types='@modern-js/app-tools/types' />\ndeclare module 'orders/Page*' { const Page: import('react').ComponentType<{ id: string }>; export default Page; }\n",
      'scripts/validate-ultramodern-workspace.mts':
        "import { Effect } from 'effect';\nEffect.runSync(Effect.log('consumer authorization and workspace checks'));\n",
      'scripts/setup-agent-reference-repos.mjs':
        "console.log('consumer reference policy');\n",
      'scripts/materialize-zerops-runtime.mjs':
        "console.log('consumer worker deployment');\n",
      'zerops.yaml':
        'zerops:\n  - setup: consumer-worker\n    run:\n      start: node worker.mjs\n',
    };
    fs.rmSync(
      path.join(workspaceRoot, 'scripts/setup-agent-reference-repos.mts'),
    );
    for (const [relativePath, source] of Object.entries(authoredFiles)) {
      fs.writeFileSync(path.join(workspaceRoot, relativePath), source);
    }
    const rootPackage = readJson(workspaceRoot, 'package.json');
    rootPackage.packageManager = 'pnpm@11.25.0';
    rootPackage.scripts['agents:refs:install'] =
      'node ./scripts/setup-agent-reference-repos.mjs';
    writeJson(workspaceRoot, 'package.json', rootPackage);
    const compact = readJson(workspaceRoot, '.modernjs/ultramodern.json');
    compact.workspace.packageManager.version = '11.25.0';
    writeJson(workspaceRoot, '.modernjs/ultramodern.json', compact);
    const topology = readJson(
      workspaceRoot,
      'topology/reference-topology.json',
    );
    const sharedPackage = {
      id: 'core-runtime',
      package: '@consumer-artifacts/core-runtime',
      path: 'packages/core-runtime',
    };
    topology.sharedPackages.unshift(sharedPackage);
    topology.validation.commands.push('pnpm authorization:check');
    delete topology.verticals[0].api.domainOperations;
    writeJson(workspaceRoot, 'topology/reference-topology.json', topology);
    const mfPath = path.join(
      workspaceRoot,
      'verticals/orders/module-federation.config.ts',
    );
    const customMf = `${fs.readFileSync(mfPath, 'utf8')}\nexport const consumerOwnership = true;\n`;
    fs.writeFileSync(mfPath, customMf);
    const fragmentsPath = path.join(
      workspaceRoot,
      'verticals/orders/src/routes/[lang]/_mf',
    );
    fs.rmSync(fragmentsPath, { recursive: true, force: true });

    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    for (const [relativePath, source] of Object.entries(authoredFiles)) {
      assert.equal(
        fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8'),
        source,
        relativePath,
      );
    }
    assert.equal(
      fs.existsSync(
        path.join(workspaceRoot, 'scripts/setup-agent-reference-repos.mts'),
      ),
      false,
    );
    const migratedRoot = readJson(workspaceRoot, 'package.json');
    assert.equal(
      migratedRoot.scripts['agents:refs:install'],
      rootPackage.scripts['agents:refs:install'],
    );
    assert.equal(migratedRoot.packageManager, 'pnpm@11.25.0');
    assert.equal(
      readJson(workspaceRoot, '.modernjs/ultramodern.json').workspace
        .packageManager.version,
      '11.25.0',
    );
    assert.match(
      fs.readFileSync(path.join(workspaceRoot, '.mise.toml'), 'utf8'),
      /pnpm = "11\.25\.0"/u,
    );
    const migratedTopology = readJson(
      workspaceRoot,
      'topology/reference-topology.json',
    );
    assert.deepEqual(migratedTopology.sharedPackages[0], sharedPackage);
    assert.ok(
      migratedTopology.validation.commands.includes('pnpm authorization:check'),
    );
    assert.equal(migratedTopology.verticals[0].api.domainOperations, undefined);
    assert.equal(fs.readFileSync(mfPath, 'utf8'), customMf);
    assert.equal(fs.existsSync(fragmentsPath), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('generated source ownership ignores width, quotes and commas while preserving consumer bytes', async () => {
  const source = `import { createRemoteComponent } from '@modern-js/runtime/mf';
export const registry = { orders: createRemoteComponent({ loader: () => import('orders/Page'), loading: 'Please wait for the order interface to finish loading' }) };
`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-semantic-owned-'));
  try {
    const file = path.join(root, 'registry.ts');
    for (const printWidth of [80, 120, 160]) {
      for (const singleQuote of [false, true]) {
        for (const trailingComma of ['all', 'none'] as const) {
          const formatted = await format('registry.ts', source, {
            printWidth,
            singleQuote,
            trailingComma,
          });
          const authored = `// Consumer formatting and explanatory comment.\n${formatted.code}`;
          assert.equal(
            generatedUiSourceRequiresRewrite(authored, source),
            false,
          );
          fs.writeFileSync(file, authored);
          assert.equal(
            writeGeneratedUiSourceIfChanged(
              createMigrationIo(root, false),
              file,
              source,
            ),
            false,
          );
          assert.equal(fs.readFileSync(file, 'utf8'), authored);
          const changed = authored.replace(
            'orders/Page',
            'orders/ConsumerPage',
          );
          assert.equal(generatedUiSourceRequiresRewrite(changed, source), true);
          fs.writeFileSync(file, changed);
          assert.equal(
            writeGeneratedUiSourceIfChanged(
              createMigrationIo(root, false),
              file,
              source,
            ),
            false,
          );
          assert.equal(fs.readFileSync(file, 'utf8'), changed);
        }
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('native formatter import sorting recognizes generated fragments but not side-effect order or JSX content edits', () => {
  const source = createRemoteExposeFragmentPage(
    {
      id: 'catalog',
      directory: 'verticals/catalog',
      kind: 'vertical',
      packageSuffix: 'catalog',
      displayName: 'Catalog',
      portEnv: 'PORT_CATALOG',
      ownership: { team: 'catalog' },
      mfName: 'catalog',
      port: 3100,
      exposes: { './Widget': './src/components/widget.tsx' },
    },
    './Widget',
  );
  const [formatted] = formatGeneratedSourceCandidates([['page.tsx', source]]);
  assert.equal(generatedUiSourceRequiresRewrite(formatted, source), false);
  assert.equal(
    generatedUiSourceRequiresRewrite(
      "import './register-first';\nimport './register-second';\nexport const ready = true;",
      "import './register-second';\nimport './register-first';\nexport const ready = true;",
    ),
    true,
  );
  assert.equal(
    generatedUiSourceRequiresRewrite(
      'export const Page = () => <p>consumer text</p>;',
      'export const Page = () => <p>consumer  text</p>;',
    ),
    true,
  );
  assert.equal(
    generatedUiSourceRequiresRewrite(
      "export const value = 'consumer text';",
      "export const value = 'consumer  text';",
    ),
    true,
  );
});

test.each([
  80, 120, 160,
])('native provider migration recognizes prior generated imports at width %s and preserves authored programs', async printWidth => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-native-provider-migration-'),
  );
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'native-providers',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(root);
    addUltramodernVertical({
      workspaceRoot: root,
      name: 'catalog',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    const config = readUltramodernConfig(root);
    const shellConfig = config.topology.apps.find(app => app.kind === 'shell')!;
    shellConfig.moduleFederation ??= {};
    // Exercise an explicit shell-to-vertical registry with real generator output.
    shellConfig.moduleFederation.verticalRefs = ['catalog'];
    const apps = allWorkspaceAppsFromToolingConfig(config);
    const shell = apps.find(app => app.kind === 'shell')!;
    const remotes = apps.filter(app => app.kind !== 'shell');
    for (const worker of [false, true])
      fs.writeFileSync(
        path.join(
          root,
          `apps/shell-super-app/src/federated-components${worker ? '.worker' : ''}.tsx`,
        ),
        createFederatedComponentsRegistry(
          config.workspace.packageScope,
          shell,
          remotes,
          worker,
        ),
      );
    fs.writeFileSync(
      path.join(root, 'apps/shell-super-app/src/modern.runtime.ts'),
      createAppRuntimeConfig(shell, config.workspace.packageScope, remotes),
    );
    for (const app of apps) {
      fs.writeFileSync(
        path.join(root, app.directory, 'modern.config.ts'),
        createAppModernConfig(
          config.workspace.packageScope,
          app,
          remotes,
          true,
        ),
      );
      fs.writeFileSync(
        path.join(root, app.directory, 'module-federation.config.ts'),
        app.kind === 'shell'
          ? createShellModuleFederationConfig(
              config.workspace.packageScope,
              app,
              remotes,
              false,
            )
          : createRemoteModuleFederationConfig(
              config.workspace.packageScope,
              app,
              remotes,
              false,
            ),
      );
    }
    const files = [
      'apps/shell-super-app/src/modern.runtime.ts',
      'apps/shell-super-app/src/federated-components.tsx',
      'apps/shell-super-app/src/federated-components.worker.tsx',
      'verticals/catalog/src/routes/[lang]/_mf/fragment/widget/page.tsx',
      'apps/shell-super-app/modern.config.ts',
      'apps/shell-super-app/module-federation.config.ts',
      'verticals/catalog/modern.config.ts',
      'verticals/catalog/module-federation.config.ts',
    ];
    const current = new Map(
      files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]),
    );
    const old = new Map<string, string>();
    for (const [file, source] of current) {
      const previous = (
        file.endsWith('/modern.config.ts')
          ? previousCompositionSource(source)
          : source
      )
        .replaceAll(
          '@modern-js/federation-runtime/distributed-ssr',
          '@modern-js/runtime/module-federation/distributed-ssr',
        )
        .replaceAll(
          '@modern-js/federation-runtime',
          '@modern-js/runtime/module-federation',
        )
        .replaceAll(
          '@modern-js/boundary-debugger',
          '@modern-js/runtime-extensions/boundary-debugger',
        )
        .replaceAll(
          '@modern-js/app-tools-extensions/config',
          '@modern-js/app-tools/config',
        );
      assert.notEqual(previous, source, file);
      const formatted = (
        await format(file, previous, {
          printWidth,
          singleQuote: printWidth === 120,
          trailingComma: printWidth === 80 ? 'none' : 'all',
        })
      ).code;
      old.set(file, formatted);
      fs.writeFileSync(path.join(root, file), formatted);
    }
    const run = () => {
      const io = createMigrationIo(root, false);
      updateGeneratedTypeScriptSurfaces(io, config);
      updateGeneratedModernConfigs(io, config);
    };
    run();
    const migrated = new Map<string, string>();
    for (const [file, source] of current) {
      const output = fs.readFileSync(path.join(root, file), 'utf8');
      assert.equal(
        generatedUiSourceRequiresRewrite(output, source),
        false,
        file,
      );
      assert.doesNotMatch(
        output,
        /@modern-js\/(?:runtime\/module-federation|runtime-extensions\/boundary-debugger|app-tools\/config)/u,
        file,
      );
      migrated.set(file, output);
    }
    run();
    for (const [file, source] of migrated)
      assert.equal(
        fs.readFileSync(path.join(root, file), 'utf8'),
        source,
        file,
      );
    for (const [file, source] of old)
      fs.writeFileSync(
        path.join(root, file),
        `${source}\nexport const authoredBusinessPolicy = 'keep';\n`,
      );
    run();
    for (const [file, source] of old) {
      const authored = `${source}\nexport const authoredBusinessPolicy = 'keep';\n`;
      const expected = file.includes('/src/')
        ? authored
            .replace(
              '@modern-js/runtime/module-federation/distributed-ssr',
              '@modern-js/federation-runtime/distributed-ssr',
            )
            .replace(
              '@modern-js/runtime/module-federation',
              '@modern-js/federation-runtime',
            )
            .replace(
              '@modern-js/runtime-extensions/boundary-debugger',
              '@modern-js/boundary-debugger',
            )
        : authored;
      assert.equal(
        fs.readFileSync(path.join(root, file), 'utf8'),
        expected,
        file,
      );
    }
    const runtimePath = path.join(
      root,
      'apps/shell-super-app/src/modern.runtime.ts',
    );
    for (const importClause of [
      'unknownProvider',
      '* as boundaryDebugger',
      '{ unknownProvider }',
      '{ ultramodernBoundaryDebuggerPlugin, unknownProvider }',
    ]) {
      const authored = `import ${importClause} from '@modern-js/runtime/boundary-debugger';\nexport const authored = true;\n`;
      fs.writeFileSync(runtimePath, authored);
      updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
      assert.equal(fs.readFileSync(runtimePath, 'utf8'), authored);
    }
    const historical = `// Historical runtime keeps its own locale resource helper.\nimport { ultramodernBoundaryDebuggerPlugin as debuggerPlugin } from '@modern-js/runtime/boundary-debugger';\nexport const flattenLocaleResource = (value: string) => ({ value });\nexport const plugins = [debuggerPlugin];\n`;
    fs.writeFileSync(runtimePath, historical);
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.equal(
      fs.readFileSync(runtimePath, 'utf8'),
      historical.replace(
        '@modern-js/runtime/boundary-debugger',
        '@modern-js/boundary-debugger',
      ),
    );
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.equal(
      fs.readFileSync(runtimePath, 'utf8'),
      historical.replace(
        '@modern-js/runtime/boundary-debugger',
        '@modern-js/boundary-debugger',
      ),
    );
    fs.writeFileSync(runtimePath, historical);
    const failingIo = createMigrationIo(root, false);
    const write = failingIo.write;
    failingIo.write = (filePath, source) => {
      if (filePath === runtimePath)
        throw new Error('native provider write failed');
      return write(filePath, source);
    };
    assert.throws(
      () => updateGeneratedTypeScriptSurfaces(failingIo, config),
      /native provider write failed/,
    );
    assert.equal(fs.readFileSync(runtimePath, 'utf8'), historical);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test.each([
  'LF',
  'CRLF',
] as const)('historical config migration accepts %s templates and preserves authored programs', lineEnding => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-template-newlines-'));
  const readFileSync = fs.readFileSync;
  const templatePath = path.join(
    createPackageRoot,
    'templates/workspace/apps/modern.config.ts.handlebars',
  );
  let templateReads = 0;
  let templateSpy: ReturnType<typeof rstest.spyOn> | undefined;
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'template-newlines',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(root);
    const config = readUltramodernConfig(root);
    const app = allWorkspaceAppsFromToolingConfig(config)[0];
    const file = path.join(root, app.directory, 'modern.config.ts');
    const current = fs.readFileSync(file, 'utf8');
    const predecessors = [
      addLegacyGeneratedDefaults(
        removeTsCheckerBuildOverride(
          current.replace(
            'pluginTailwindcss()',
            'pluginTailwindcss({ optimize: false })',
          ),
        ),
      ),
      removeReleaseEnvelopePlugin(previousCompositionSource(current)),
      previousCompositionSource(current),
    ];
    templateSpy = rstest
      .spyOn(fs, 'readFileSync')
      .mockImplementation((filePath, options) => {
        const source = readFileSync(filePath, options);
        if (filePath !== templatePath) return source;
        assert.equal(typeof source, 'string');
        templateReads++;
        return source.replace(/\r?\n/gu, lineEnding === 'CRLF' ? '\r\n' : '\n');
      });
    const run = () =>
      updateGeneratedModernConfigs(createMigrationIo(root, false), config);
    for (const predecessor of predecessors) {
      fs.writeFileSync(file, predecessor);
      run();
      const migrated = fs.readFileSync(file, 'utf8');
      assert.equal(generatedUiSourceRequiresRewrite(migrated, current), false);
      run();
      assert.equal(fs.readFileSync(file, 'utf8'), migrated);
      const authored = `${predecessor}\nexport const authoredBusinessPolicy = 'keep';\n`;
      fs.writeFileSync(file, authored);
      run();
      assert.equal(fs.readFileSync(file, 'utf8'), authored);
    }
    assert.ok(templateReads > 0);
  } finally {
    templateSpy?.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test.each([
  'LF',
  'CRLF',
] as const)('BFF import migration preserves %s consumer text and static binding forms', lineEnding => {
  const newline = lineEnding === 'CRLF' ? '\r\n' : '\n';
  for (const [clause, call] of [
    ['{ bffPlugin as productApi }', 'productApi()'],
    ['productApi', 'productApi()'],
    ['* as productApi', 'productApi.bffPlugin()'],
    ['{ default as productApi }', 'productApi()'],
  ]) {
    for (const oldPackage of [
      '@modern-js/plugin-bff',
      '@modern-js/plugin-bff/cli',
    ]) {
      const original = [
        '// Consumer comment retains the old name @modern-js/plugin-bff',
        `import ${clause} from "${oldPackage}"; // keep import comment`,
        "import { defineEffectBff } from '@modern-js/plugin-bff/effect-edge';",
        "const text = `import { bffPlugin } from '@modern-js/plugin-bff';`;",
        "const lazy = () => import('@modern-js/plugin-bff');",
        `export default { bff: { runtimeFramework: 'effect' }, plugins: [${call}], consumerPolicy: 'keep' };`,
        '',
      ].join(newline);
      const expected = original.replace(
        `from "${oldPackage}"`,
        'from "@modern-js/plugin-bff-build-extensions"',
      );
      assert.equal(migrateBffBuildPluginImports(original), expected);
      assert.equal(migrateBffBuildPluginImports(expected), expected);
    }
  }
});

test('BFF import migration splits native mixed imports and preserves unrelated declarations', () => {
  const original =
    "import { bffPlugin as productApi, /* consumer comment */ consumerValue } from '@modern-js/plugin-bff';\nexport const policy = consumerValue;\nexport const plugin = productApi();\nexport default { bff: { runtimeFramework: 'effect' }, plugins: [plugin] };\n";
  const expected =
    "import { bffPlugin as productApi } from '@modern-js/plugin-bff-build-extensions';\nimport {  /* consumer comment */ consumerValue } from '@modern-js/plugin-bff';\nexport const policy = consumerValue;\nexport const plugin = productApi();\nexport default { bff: { runtimeFramework: 'effect' }, plugins: [plugin] };\n";
  assert.equal(migrateBffBuildPluginImports(original), expected);
  assert.equal(migrateBffBuildPluginImports(expected), expected);
  for (const unchanged of [
    "import type { bffPlugin } from '@modern-js/plugin-bff';",
    "import { type bffPlugin } from '@modern-js/plugin-bff';",
    "import '@modern-js/plugin-bff';",
    "const example = `import { bffPlugin } from '@modern-js/plugin-bff';`;",
    "const plugin = require('@modern-js/plugin-bff');",
    "import { bffPlugin } from '@modern-js/plugin-bff'; export const incomplete = ;",
  ])
    assert.equal(migrateBffBuildPluginImports(unchanged), unchanged);
});

test('BFF build migration recognizes generated predecessors and changes only authored import paths', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-bff-build-migration-'),
  );
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'bff-migration',
      modernVersion: '3.8.3',
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(root);
    addUltramodernVertical({
      workspaceRoot: root,
      name: 'catalog',
      modernVersion: '3.8.3',
      packageSource: { strategy: 'workspace' },
    });
    const config = readUltramodernConfig(root);
    const file = path.join(root, 'verticals/catalog/modern.config.ts');
    const current = fs.readFileSync(file, 'utf8');
    assert.match(
      current,
      /import \{ bffPlugin \} from '@modern-js\/plugin-bff-build-extensions'/u,
    );
    const previous = current.replace(
      "from '@modern-js/plugin-bff-build-extensions'",
      "from '@modern-js/plugin-bff'",
    );
    fs.writeFileSync(file, previous);
    const run = () =>
      updateGeneratedModernConfigs(createMigrationIo(root, false), config);
    run();
    assert.equal(fs.readFileSync(file, 'utf8'), current);
    const comment = '\n// Consumer deployment rationale\n';
    fs.writeFileSync(file, previous + comment);
    run();
    assert.equal(fs.readFileSync(file, 'utf8'), current + comment);
    const businessPolicy =
      "\n// Consumer policy\nexport const businessPolicy = { owner: 'catalog', retry: 7 };\n";
    fs.writeFileSync(file, previous + businessPolicy);
    run();
    assert.equal(fs.readFileSync(file, 'utf8'), current + businessPolicy);
    run();
    assert.equal(fs.readFileSync(file, 'utf8'), current + businessPolicy);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('BFF build import adoption requires active supported config provenance', () => {
  const bffImport = "import { bffPlugin } from '@modern-js/plugin-bff';\n";
  const nativeImports =
    "import { appTools, defineConfig } from '@modern-js/app-tools';\n";
  const nativeConfig =
    'export default defineConfig({ plugins: [appTools(), bffPlugin()] });\n';
  for (const original of [
    bffImport + nativeImports + nativeConfig,
    bffImport +
      nativeImports +
      "export default defineConfig({ bff: { runtimeFramework: 'effect', runtimeFramework: 'hono' }, plugins: [appTools(), bffPlugin()] });",
    bffImport +
      nativeImports +
      "import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';\nexport default defineConfig({ plugins: [ultramodernAppTools()], plugins: [appTools(), bffPlugin()] });",
    bffImport +
      nativeImports +
      "export default defineConfig({ bff: { runtimeFramework: 'effect' }, ...unknownConfig, plugins: [appTools(), bffPlugin()] });",
    bffImport +
      nativeImports +
      "export default defineConfig({ plugins: [appTools(), bffPlugin()] }, { bff: { runtimeFramework: 'effect' } });",
    bffImport +
      nativeImports +
      "export default defineConfig({ bff: { runtimeFramework: 'hono' }, plugins: [appTools(), bffPlugin()] });",
    bffImport +
      nativeImports +
      "import { presetUltramodern } from '@modern-js/ultramodern-app-tools';\n" +
      nativeConfig,
    bffImport +
      nativeImports +
      "const unused = { bff: { runtimeFramework: 'effect' } };\n" +
      nativeConfig,
    bffImport +
      nativeImports +
      'const presetUltramodern = value => value;\nexport default defineConfig(presetUltramodern({ plugins: [appTools(), bffPlugin()] }));',
    bffImport +
      nativeImports +
      "import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';\nexport default defineConfig({ custom: () => ultramodernAppTools(), plugins: [appTools(), bffPlugin()] });",
    bffImport +
      nativeImports +
      "import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';\nexport default defineConfig({ metadata: { plugins: [ultramodernAppTools()] }, plugins: [appTools(), bffPlugin()] });",
  ])
    assert.equal(migrateBffBuildPluginImports(original), original);

  const forkImport =
    "import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';\n";
  for (const body of [
    'const plugins = [ultramodernAppTools(), bffPlugin()]; plugins[0] = appTools(); export default defineConfig({ plugins });',
    'const config = { plugins: [ultramodernAppTools(), bffPlugin()] }; config.plugins = [appTools(), bffPlugin()]; export default defineConfig(config);',
    'const plugins = [ultramodernAppTools(), bffPlugin()]; configurePlugins(plugins); export default defineConfig({ plugins });',
    'const plugins = [ultramodernAppTools(), bffPlugin()]; const escaped = plugins; escaped[0] = appTools(); export default defineConfig({ plugins });',
    'const plugins = [ultramodernAppTools(), bffPlugin()]; const mutate = () => plugins.splice(0, 1, appTools()); mutate(); export default defineConfig({ plugins });',
  ]) {
    const original = bffImport + nativeImports + forkImport + body;
    assert.equal(migrateBffBuildPluginImports(original), original);
  }

  for (const body of [
    "const defaults = { bff: { runtimeFramework: 'effect' } };\nexport const config = defineConfig({ ...defaults, plugins: [appTools(), bffPlugin()] });\nexport default config;",
    "import { ultramodernAppTools as framework } from '@modern-js/ultramodern-app-tools';\nconst plugins = [framework(), bffPlugin()];\nconst config = defineConfig({ plugins });\nexport default config;",
    "import { presetUltramodern as preset } from '@modern-js/app-tools';\nexport default defineConfig(preset({ plugins: [appTools(), bffPlugin()] }));",
    "import * as framework from '@modern-js/ultramodern-app-tools';\nexport default defineConfig({ plugins: [framework.ultramodernAppTools(), bffPlugin()] });",
    "const bff = { runtimeFramework: 'effect' } as const;\nconst config = defineConfig({ bff, plugins: [appTools(), bffPlugin()] });\nexport { config as default };",
  ]) {
    const original = bffImport + nativeImports + body;
    const expected = original.replace(
      "from '@modern-js/plugin-bff'",
      "from '@modern-js/plugin-bff-build-extensions'",
    );
    assert.equal(migrateBffBuildPluginImports(original), expected);
    assert.equal(migrateBffBuildPluginImports(expected), expected);
  }
});

test('historical generated app tsconfigs add the JSON build input from complete predecessor evidence', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-tsconfig-input-migrate-'),
  );
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'workspace',
      modernVersion: '3.2.1',
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(root);
    for (const preset of ['ui-only', 'api-only'] as const) {
      addUltramodernVertical({
        workspaceRoot: root,
        name: preset === 'ui-only' ? 'catalog' : 'orders',
        modernVersion: '3.2.1',
        enableTailwind: false,
        packageSource: { strategy: 'workspace' },
        preset,
      });
    }
    const config = readUltramodernConfig(root);
    const apps = allWorkspaceAppsFromToolingConfig(config);
    const remotes = apps.filter(app => app.kind !== 'shell');
    const predecessors = apps.map(app => {
      const current = createAppTsConfig(app, remotes) as { include: string[] };
      const previous = {
        ...current,
        include: current.include.filter(
          input => input !== 'shared/ultramodern-build.json',
        ),
      };
      return [
        `${app.directory}/tsconfig.json`,
        `${JSON.stringify(previous, null, 2)}\n`,
      ] as const;
    });
    const formatted = formatGeneratedSourceCandidates(predecessors);
    for (const [index, [file, raw]] of predecessors.entries()) {
      fs.writeFileSync(
        path.join(root, file),
        index === 0 ? raw : formatted[index],
      );
    }
    const before = snapshotWorkspace(root);
    const dryIo = createMigrationIo(root, true);
    updateGeneratedTypeScriptSurfaces(dryIo, config);
    assert.deepEqual(snapshotWorkspace(root), before);
    for (const [file] of predecessors)
      assert.ok(
        dryIo.plan.includes(`[dry-run] would write ${file}`),
        dryIo.plan.join('\n'),
      );

    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    for (const app of apps) {
      assert.deepEqual(
        readJson(root, `${app.directory}/tsconfig.json`),
        createAppTsConfig(app, remotes),
      );
    }
    const after = snapshotWorkspace(root);
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.deepEqual(snapshotWorkspace(root), after);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('historical JSON input migration preserves consumer bytes and requires generated app identity', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-tsconfig-input-owned-'),
  );
  try {
    generateUltramodernWorkspace({
      targetDir: root,
      packageName: 'workspace',
      modernVersion: '3.2.1',
      packageSource: { strategy: 'workspace' },
    });
    linkWorkspaceFormatterDependencies(root);
    const config = readUltramodernConfig(root);
    const app = allWorkspaceAppsFromToolingConfig(config)[0];
    assert.ok(app);
    const file = `${app.directory}/tsconfig.json`;
    const filePath = path.join(root, file);
    const current = createAppTsConfig(app) as {
      include: string[];
      compilerOptions: Record<string, unknown>;
      references: unknown[];
    };
    const previous = {
      ...current,
      include: current.include.filter(
        input => input !== 'shared/ultramodern-build.json',
      ),
    };
    const raw = `${JSON.stringify(previous, null, 2)}\n`;
    const variants = [
      JSON.stringify({
        ...previous,
        include: [...previous.include, 'presentation/**/*.ts'],
      }),
      JSON.stringify({
        ...previous,
        compilerOptions: {
          ...previous.compilerOptions,
          paths: { '@product/*': ['./src/product/*'] },
        },
      }),
      JSON.stringify({
        ...previous,
        references: [
          ...previous.references,
          { path: '../../packages/product' },
        ],
      }),
      raw.replace('{', '{\n  // Consumer configuration'),
      raw.replace('{', '{\n  "include": ["product"],'),
      raw.replaceAll('  ', '\t'),
    ];
    for (const source of variants) {
      fs.writeFileSync(filePath, source);
      const output = captureStdout(() =>
        updateGeneratedTypeScriptSurfaces(
          createMigrationIo(root, false),
          config,
        ),
      );
      assert.equal(fs.readFileSync(filePath, 'utf8'), source);
      assert.match(output.output, /preserved consumer-owned TypeScript/u);
      assert.match(output.output, /shared\/ultramodern-build\.json/u);
    }
    fs.writeFileSync(filePath, raw);
    const packagePath = path.join(root, app.directory, 'package.json');
    const packageBytes = fs.readFileSync(packagePath);
    const packageJson = JSON.parse(packageBytes.toString());
    fs.writeFileSync(
      packagePath,
      JSON.stringify({ ...packageJson, name: '@consumer/owned' }),
    );
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.equal(fs.readFileSync(filePath, 'utf8'), raw);
    fs.writeFileSync(packagePath, packageBytes);

    const manifestPath = path.join(root, '.modernjs/ultramodern.json');
    const manifestBytes = fs.readFileSync(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString());
    delete manifest.generator;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.equal(fs.readFileSync(filePath, 'utf8'), raw);
    fs.writeFileSync(manifestPath, manifestBytes);

    const linkedFile = path.join(root, 'consumer-tsconfig.json');
    fs.writeFileSync(linkedFile, raw);
    fs.unlinkSync(filePath);
    fs.symlinkSync(linkedFile, filePath);
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.equal(fs.lstatSync(filePath).isSymbolicLink(), true);
    assert.equal(fs.readFileSync(linkedFile, 'utf8'), raw);
    fs.unlinkSync(filePath);
    const currentBytes = `${JSON.stringify(current, null, 4)}\n`;
    fs.writeFileSync(filePath, currentBytes);
    updateGeneratedTypeScriptSurfaces(createMigrationIo(root, false), config);
    assert.equal(fs.readFileSync(filePath, 'utf8'), currentBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
