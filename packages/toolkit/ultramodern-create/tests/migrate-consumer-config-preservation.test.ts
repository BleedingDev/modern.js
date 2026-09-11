import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { migrateBffBuildPluginImports } from '../src/ultramodern-tooling/commands/migrate-strict-effect/bff-build-plugin-migration';
import { migrateAppToolsConfigImports } from '../src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-modern-configs';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
} from '../src/ultramodern-workspace';
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
    const consumerModernConfig = `import { appTools, defineConfig } from '@modern-js/app-tools';
import { getBuildConfigEnvironment } from '@modern-js/app-tools/config';
import { bffPlugin } from '@modern-js/plugin-bff';

export const presentationAccessPolicy = {
  studioHost: '127.0.0.1',
  validateManifest: true,
} as const;

const port = Number(getBuildConfigEnvironment('SHELL_SUPER_APP_PORT') ?? 3020);

export default defineConfig({
  bff: {
    prefix: '/api/product',
    runtimeFramework: 'effect',
  },
  plugins: [appTools(), bffPlugin()],
  server: {
    port,
  },
});
`;
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
      consumerModernConfig
        .replace(
          "from '@modern-js/plugin-bff';",
          "from '@modern-js/plugin-bff-build-extensions';",
        )
        .replace(
          "from '@modern-js/app-tools/config';",
          "from '@modern-js/app-tools-extensions/config';",
        ),
    );
    const migratedShellPackage = readJson(workspaceRoot, shellPackagePath);
    assert.equal(migratedShellPackage.dependencies['react-router'], undefined);
    assert.equal(migratedShellPackage.scripts.dev, consumerDevScript);
    assert.equal(migratedShellPackage.scripts.build, consumerBuildScript);
    assert.equal(migratedShellPackage.scripts.serve, consumerServeScript);
    const migratedRootPackage = readJson(workspaceRoot, 'package.json');
    assert.equal(migratedRootPackage.scripts.build, consumerRootBuildScript);
    assert.deepEqual(
      readJson(workspaceRoot, 'tsconfig.base.json'),
      baseTsConfig,
    );
    assert.deepEqual(readJson(workspaceRoot, shellTsConfigPath), shellTsConfig);
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

test('BFF import migration splits mixed imports and leaves non-value imports alone', () => {
  const original =
    "import { bffPlugin as productApi, /* consumer comment */ consumerValue } from '@modern-js/plugin-bff';\nexport const policy = consumerValue;\nexport const plugin = productApi();\nexport default { bff: { runtimeFramework: 'effect' }, plugins: [plugin] };\n";
  const expected =
    "import { bffPlugin as productApi } from '@modern-js/plugin-bff-build-extensions';\nimport {  /* consumer comment */ consumerValue } from '@modern-js/plugin-bff';\nexport const policy = consumerValue;\nexport const plugin = productApi();\nexport default { bff: { runtimeFramework: 'effect' }, plugins: [plugin] };\n";
  assert.equal(migrateBffBuildPluginImports(original), expected);
  assert.equal(migrateBffBuildPluginImports(expected), expected);
  for (const unchanged of [
    "import type { bffPlugin } from '@modern-js/plugin-bff';",
    "import '@modern-js/plugin-bff';",
    "const example = `import { bffPlugin } from '@modern-js/plugin-bff';`;",
    "const plugin = require('@modern-js/plugin-bff');",
  ])
    assert.equal(migrateBffBuildPluginImports(unchanged), unchanged);
});

test('config import migration preserves authored bytes, comments, and ordinary strings', () => {
  const source = [
    '// import { example } from "@modern-js/app-tools/config";',
    'import { getBuildConfigEnvironment as environment } from "@modern-js/app-tools/config";',
    "import type { Config } from '@modern-js/app-tools/config';",
    'export const text = "@modern-js/app-tools/config";',
    'export default { custom: environment(), exposes: { "./Tractor": "./src/Tractor.tsx" } };',
    '',
  ].join('\r\n');
  const expected = source
    .replace(
      'as environment } from "@modern-js/app-tools/config"',
      'as environment } from "@modern-js/app-tools-extensions/config"',
    )
    .replace(
      "{ Config } from '@modern-js/app-tools/config'",
      "{ Config } from '@modern-js/app-tools-extensions/config'",
    );
  assert.equal(migrateAppToolsConfigImports(source), expected);
  assert.equal(migrateAppToolsConfigImports(expected), expected);
  const malformed = `${source}\nexport default {`;
  assert.equal(migrateAppToolsConfigImports(malformed), malformed);
});
