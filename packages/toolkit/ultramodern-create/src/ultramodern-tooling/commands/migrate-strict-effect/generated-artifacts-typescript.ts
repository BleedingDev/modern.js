import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { ULTRAMODERN_CREATE_PACKAGE } from '../../../ultramodern-package-source';
import {
  createAppEnvDts,
  createAppRuntimeConfig,
} from '../../../ultramodern-workspace/app-files';
import {
  createFederatedComponentsRegistry,
  createRemoteExposeFragmentPage,
  createShellRemoteComponents,
  createShellWorkerRemoteComponents,
  regenerateGeneratedNavigationSurface,
  regenerateGeneratedProductRouteAdapter,
  remoteComponentOutputPath,
} from '../../../ultramodern-workspace/demo-components';
import {
  appEmitsBrowserUi,
  appI18nNamespace,
  distributedSsrExposes,
  distributedSsrFragmentSlug,
  resolveRemoteRefs,
} from '../../../ultramodern-workspace/descriptors';
import { formatGeneratedSourceCandidates } from '../../../ultramodern-workspace/fs-io';
import {
  createAppMfTypesTsConfig,
  createAppTsConfig,
  createSharedPackageTsConfig,
  createTsConfigBase,
} from '../../../ultramodern-workspace/package-json';
import {
  allWorkspaceAppsFromToolingConfig,
  type UltramodernToolingConfig,
} from '../../config';
import { generatedUiSourceRequiresRewrite } from './generated-ui-source';
import { type MigrationIo, writeJsonFile } from './io';

type JsonObject = Record<string, unknown>;

function jsonObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function readJsonObject(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  return jsonObject(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
}

/**
 * Move named imports only when the generated target identifies one provider.
 * Authored programs retain every byte outside the migrated module literals;
 * complete generated programs may also use the generated-source formatter.
 */
function migrateGeneratedProviderImports(
  io: MigrationIo,
  filePath: string,
  generatedSource: string,
) {
  if (!fs.existsSync(filePath)) return false;
  const source = fs.readFileSync(filePath, 'utf8');
  const legacyProviders: Record<string, readonly string[]> = {
    '@modern-js/federation-runtime': ['@modern-js/runtime/module-federation'],
    '@modern-js/federation-runtime/distributed-ssr': [
      '@modern-js/runtime/module-federation',
      '@modern-js/runtime/module-federation/distributed-ssr',
    ],
    '@modern-js/boundary-debugger': [
      '@modern-js/runtime-extensions/boundary-debugger',
      '@modern-js/runtime/boundary-debugger',
    ],
  };
  let updated = source;
  try {
    const options = {
      sourceType: 'module' as const,
      plugins: ['typescript' as const, 'jsx' as const],
    };
    const current = parse(source, options);
    const generated = parse(generatedSource, options);
    const targets = generated.program.body.filter(
      statement => statement.type === 'ImportDeclaration',
    );
    const edits: Array<{ start: number; end: number; content: string }> = [];
    for (const statement of current.program.body) {
      if (statement.type !== 'ImportDeclaration') continue;
      const matches = targets.filter(
        target =>
          target.type === 'ImportDeclaration' &&
          legacyProviders[target.source.value]?.includes(
            statement.source.value,
          ) &&
          statement.specifiers.length > 0 &&
          statement.specifiers.every(
            specifier =>
              specifier.type === 'ImportSpecifier' &&
              target.specifiers.some(
                expected =>
                  expected.type === 'ImportSpecifier' &&
                  (expected.imported.type === 'Identifier'
                    ? expected.imported.name
                    : expected.imported.value) ===
                    (specifier.imported.type === 'Identifier'
                      ? specifier.imported.name
                      : specifier.imported.value),
              ),
          ),
      );
      if (matches.length !== 1) continue;
      edits.push({
        start: statement.source.start!,
        end: statement.source.end!,
        content: JSON.stringify(matches[0].source.value),
      });
    }
    if (edits.length === 0) return false;
    for (const edit of edits.toSorted(
      (left, right) => right.start - left.start,
    ))
      updated =
        updated.slice(0, edit.start) + edit.content + updated.slice(edit.end);
    if (generatedUiSourceRequiresRewrite(updated, generatedSource)) {
      io.log(
        `${path.relative(io.workspaceRoot, filePath)} migrated native provider imports while preserving authored source.`,
      );
      return io.write(filePath, updated);
    }
  } catch {
    io.log(
      `${path.relative(io.workspaceRoot, filePath)} preserved authored source: native provider imports could not be proven.`,
    );
    return false;
  }
  return io.writeGenerated(filePath, updated);
}

function writeMergedTypeScriptConfig(
  io: MigrationIo,
  filePath: string,
  generated: unknown,
) {
  if (fs.existsSync(filePath)) {
    // A generated-looking JSON shape does not prove ownership of compiler
    // options, references, or formatting. Historical source upgrades require
    // an explicit recognized transition, never a merge with template defaults.
    io.log(
      `${path.relative(io.workspaceRoot, filePath)} preserved consumer-owned TypeScript configuration byte-for-byte.`,
    );
    return false;
  }
  return writeJsonFile(io, filePath, generated);
}

function generatedManifest(io: MigrationIo, config: UltramodernToolingConfig) {
  const sourcePath = path.isAbsolute(config.sourcePath)
    ? config.sourcePath
    : path.join(io.workspaceRoot, config.sourcePath);
  const manifest = readJsonObject(sourcePath);
  const generator = jsonObject(manifest?.generator);
  return generator?.package === ULTRAMODERN_CREATE_PACKAGE ||
    generator?.package === '@modern-js/create'
    ? manifest
    : undefined;
}

function manifestApps(manifest: JsonObject) {
  const topology = jsonObject(manifest.topology);
  return Array.isArray(topology?.apps)
    ? topology.apps.map(jsonObject).filter(app => app !== undefined)
    : [];
}

function packageManifest(io: MigrationIo, appDirectory: string) {
  return readJsonObject(
    path.join(io.workspaceRoot, appDirectory, 'package.json'),
  );
}

function appSurfaceIsOwned(
  io: MigrationIo,
  app: ReturnType<typeof allWorkspaceAppsFromToolingConfig>[number],
  manifestApp: JsonObject,
) {
  const packageJson = packageManifest(io, app.directory);
  return (
    manifestApp.path === app.directory &&
    manifestApp.kind === app.kind &&
    typeof manifestApp.package === 'string' &&
    packageJson?.name === manifestApp.package
  );
}

/** Add one missing input only for the complete immediate generated predecessor. */
function writeAppTypeScriptConfig(
  io: MigrationIo,
  config: UltramodernToolingConfig,
  app: ReturnType<typeof allWorkspaceAppsFromToolingConfig>[number],
  remotes: ReturnType<typeof allWorkspaceAppsFromToolingConfig>,
) {
  const filePath = path.join(io.workspaceRoot, app.directory, 'tsconfig.json');
  const generated = createAppTsConfig(app, remotes);
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (stat === undefined) return writeJsonFile(io, filePath, generated);
  const preserve = () => {
    io.log(
      `${app.directory}/tsconfig.json preserved consumer-owned TypeScript configuration byte-for-byte. ` +
        'If its generated build module imports shared/ultramodern-build.json, include that JSON input in the composite project.',
    );
    return false;
  };
  if (!stat.isFile()) return preserve();
  const source = fs.readFileSync(filePath, 'utf8');
  let existing: JsonObject | undefined;
  try {
    existing = jsonObject(JSON.parse(source));
  } catch {
    return preserve();
  }
  const input = 'shared/ultramodern-build.json';
  if (
    (Array.isArray(existing?.include) && existing.include.includes(input)) ||
    (Array.isArray(existing?.files) && existing.files.includes(input))
  )
    return false;
  const manifest = generatedManifest(io, config);
  const manifestApp =
    manifest && manifestApps(manifest).find(entry => entry.id === app.id);
  if (!manifestApp || !appSurfaceIsOwned(io, app, manifestApp))
    return preserve();

  const current = jsonObject(generated)!;
  const predecessor = {
    ...current,
    include: (current.include as string[]).filter(value => value !== input),
  };
  // Parsing is only a cheap rejection filter. Duplicate keys, comments and
  // unrecognized formatting never count as complete predecessor evidence.
  if (JSON.stringify(existing) !== JSON.stringify(predecessor))
    return preserve();
  const previousBytes = `${JSON.stringify(predecessor, null, 2)}\n`;
  const currentBytes = `${JSON.stringify(current, null, 2)}\n`;
  let target = currentBytes;
  if (source !== previousBytes) {
    const [formattedPrevious, formattedCurrent] =
      formatGeneratedSourceCandidates([
        ['previous/tsconfig.json', previousBytes],
        ['current/tsconfig.json', currentBytes],
      ]);
    if (source !== formattedPrevious) return preserve();
    target = formattedCurrent;
  }
  io.log(
    `${app.directory}/tsconfig.json migrated its recognized generated JSON build input.`,
  );
  return io.write(filePath, target);
}

function shellSurfaceIsOwned(
  io: MigrationIo,
  app: ReturnType<typeof allWorkspaceAppsFromToolingConfig>[number],
  manifestApp: JsonObject,
) {
  const moduleFederation = jsonObject(manifestApp.moduleFederation);
  return (
    appSurfaceIsOwned(io, app, manifestApp) &&
    app.kind === 'shell' &&
    moduleFederation?.role === 'host'
  );
}

function deliveryUnitSurfaceIsOwned(
  io: MigrationIo,
  config: UltramodernToolingConfig,
  app: ReturnType<typeof allWorkspaceAppsFromToolingConfig>[number],
  manifestApp: JsonObject,
  expose: string,
  sourcePath: string,
) {
  const deliveryUnit = jsonObject(manifestApp.deliveryUnit);
  const moduleFederation = jsonObject(manifestApp.moduleFederation);
  const packageJson = packageManifest(io, app.directory);
  const packageExports = jsonObject(packageJson?.exports);
  const exposedSurfaces = Array.isArray(moduleFederation?.exposes)
    ? moduleFederation.exposes
    : [];
  const packageName = manifestApp.package;
  return (
    manifestApp.kind === 'vertical' &&
    manifestApp.path === app.directory &&
    typeof packageName === 'string' &&
    packageJson?.name === packageName &&
    deliveryUnit?.kind === 'microvertical-delivery-unit' &&
    deliveryUnit.packageName === packageName &&
    deliveryUnit.unitId === `${config.workspace.packageScope}/${app.id}` &&
    exposedSurfaces.includes(expose) &&
    packageExports?.[expose] === sourcePath
  );
}

function updateGeneratedProductRouteAdapters(
  io: MigrationIo,
  config: UltramodernToolingConfig,
) {
  const manifest = generatedManifest(io, config);
  if (manifest === undefined) {
    return false;
  }

  const appsById = new Map(
    manifestApps(manifest).map(app => [String(app.id ?? ''), app]),
  );
  let changed = false;

  for (const app of allWorkspaceAppsFromToolingConfig(config)) {
    const manifestApp = appsById.get(app.id);
    if (
      (app.id !== 'decide' && app.kind !== 'shell') ||
      manifestApp === undefined ||
      !appSurfaceIsOwned(io, app, manifestApp)
    ) {
      continue;
    }

    const routeDirectory = path.join(
      io.workspaceRoot,
      app.directory,
      'src/routes/[lang]/tractors/[slug]',
    );
    for (const fileName of ['page.search.ts', 'page.tsx']) {
      const filePath = path.join(routeDirectory, fileName);
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const source = fs.readFileSync(filePath, 'utf-8');
      changed =
        io.write(filePath, regenerateGeneratedProductRouteAdapter(source)) ||
        changed;
    }
  }

  return changed;
}

function updateGeneratedNavigationSurfaces(
  io: MigrationIo,
  config: UltramodernToolingConfig,
) {
  const manifest = generatedManifest(io, config);
  if (manifest === undefined) {
    return false;
  }

  const apps = allWorkspaceAppsFromToolingConfig(config);
  const appsById = new Map(
    manifestApps(manifest).map(app => [String(app.id ?? ''), app]),
  );
  let changed = false;

  for (const app of apps) {
    const manifestApp = appsById.get(app.id);
    if (manifestApp === undefined) {
      continue;
    }

    if (app.kind === 'shell' && shellSurfaceIsOwned(io, app, manifestApp)) {
      const filePath = path.join(
        io.workspaceRoot,
        app.directory,
        'src/routes/shell-frame.tsx',
      );
      if (fs.existsSync(filePath)) {
        const source = fs.readFileSync(filePath, 'utf-8');
        changed =
          io.write(
            filePath,
            regenerateGeneratedNavigationSurface(source, 'shell-frame'),
          ) || changed;
      }
      continue;
    }

    for (const [expose, sourcePath] of Object.entries(app.exposes ?? {})) {
      const isCheckoutNavigationSurface =
        (expose === './AddToCart' &&
          sourcePath === './src/components/add-to-cart.tsx') ||
        (expose === './CheckoutPage' &&
          sourcePath === './src/components/checkout-page.tsx');
      if (app.id !== 'checkout' || !isCheckoutNavigationSurface) {
        continue;
      }
      const relativePath = remoteComponentOutputPath(app, expose);
      if (
        relativePath === undefined ||
        !deliveryUnitSurfaceIsOwned(
          io,
          config,
          app,
          manifestApp,
          expose,
          sourcePath,
        )
      ) {
        continue;
      }
      const filePath = path.join(io.workspaceRoot, relativePath);
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const source = fs.readFileSync(filePath, 'utf-8');
      if (
        !source.includes(`data-modern-boundary-id="${app.id}"`) ||
        !source.includes(`data-modern-mf-expose="${expose}"`)
      ) {
        continue;
      }
      changed =
        io.write(
          filePath,
          regenerateGeneratedNavigationSurface(
            source,
            expose === './AddToCart' ? 'checkout-add-to-cart' : 'checkout-page',
          ),
        ) || changed;
    }
  }

  return changed;
}

function ensureGeneratedIgnoreRules(io: MigrationIo) {
  const gitignorePath = path.join(io.workspaceRoot, '.gitignore');
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf-8')
    : '';
  const lines =
    existing.trimEnd().length === 0 ? [] : existing.trimEnd().split(/\r?\n/u);
  let changed = false;

  for (const rule of [
    '.mf/',
    '**/.mf/',
    'dist-cloudflare/',
    '.output/',
    '**/.output/',
    '.modern-js/',
    '**/.modern-js/',
    '**/src/modern-tanstack/',
    '**/.tsgo.*.resolved.json',
  ]) {
    if (!lines.includes(rule)) {
      lines.push(rule);
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  return io.write(gitignorePath, `${lines.join('\n')}\n`);
}

function updateGeneratedShellRuntimeSurfaces(
  io: MigrationIo,
  config: UltramodernToolingConfig,
) {
  const manifest = generatedManifest(io, config);
  if (manifest === undefined) {
    return false;
  }

  const apps = allWorkspaceAppsFromToolingConfig(config);
  const remotes = apps.filter(app => app.kind !== 'shell');
  const appsById = new Map(
    manifestApps(manifest).map(app => [String(app.id ?? ''), app]),
  );
  let changed = false;

  for (const app of apps.filter(app => app.kind === 'shell')) {
    const manifestApp = appsById.get(app.id);
    if (
      manifestApp === undefined ||
      !shellSurfaceIsOwned(io, app, manifestApp)
    ) {
      continue;
    }

    const runtimePath = path.join(
      io.workspaceRoot,
      app.directory,
      'src/modern.runtime.ts',
    );
    if (!fs.existsSync(runtimePath)) {
      continue;
    }
    const runtimeSource = fs.readFileSync(runtimePath, 'utf-8');
    if (
      !runtimeSource.includes('/verticals/') ||
      !runtimeSource.includes('/locales/')
    ) {
      continue;
    }

    const shellRemotes = resolveRemoteRefs(app, remotes);
    for (const language of ['en', 'cs'] as const) {
      const shellLocaleDirectory = path.join(
        io.workspaceRoot,
        app.directory,
        'locales',
        language,
      );
      const shellLocale =
        readJsonObject(
          path.join(shellLocaleDirectory, `${appI18nNamespace(app)}.json`),
        ) ?? {};
      const mergedLocale = Object.assign(
        {},
        shellLocale,
        ...shellRemotes.map(remote =>
          readJsonObject(
            path.join(
              io.workspaceRoot,
              remote.directory,
              'locales',
              language,
              `${appI18nNamespace(remote)}.json`,
            ),
          ),
        ),
      );
      changed =
        writeJsonFile(
          io,
          path.join(shellLocaleDirectory, `${appI18nNamespace(app)}.json`),
          mergedLocale,
        ) || changed;
      changed =
        writeJsonFile(
          io,
          path.join(shellLocaleDirectory, 'translation.json'),
          mergedLocale,
        ) || changed;
    }

    changed =
      io.write(
        runtimePath,
        createAppRuntimeConfig(app, config.workspace.packageScope, remotes),
      ) || changed;
  }

  return changed;
}

export function updateGeneratedTypeScriptSurfaces(
  io: MigrationIo,
  config: UltramodernToolingConfig,
) {
  const apps = allWorkspaceAppsFromToolingConfig(config);
  const remotes = apps.filter(app => app.kind !== 'shell');

  writeMergedTypeScriptConfig(
    io,
    path.join(io.workspaceRoot, 'tsconfig.base.json'),
    createTsConfigBase(),
  );
  ensureGeneratedIgnoreRules(io);

  for (const sharedPackage of [
    'packages/shared-contracts',
    'packages/shared-design-tokens',
  ]) {
    writeMergedTypeScriptConfig(
      io,
      path.join(io.workspaceRoot, sharedPackage, 'tsconfig.json'),
      createSharedPackageTsConfig(sharedPackage),
    );
  }

  for (const app of apps) {
    writeAppTypeScriptConfig(io, config, app, remotes);
    writeMergedTypeScriptConfig(
      io,
      path.join(io.workspaceRoot, app.directory, 'tsconfig.mf-types.json'),
      createAppMfTypesTsConfig(app),
    );
    io.write(
      path.join(io.workspaceRoot, app.directory, 'src/modern-app-env.d.ts'),
      createAppEnvDts(app, remotes, config.workspace.packageScope),
    );

    migrateGeneratedProviderImports(
      io,
      path.join(io.workspaceRoot, app.directory, 'src/modern.runtime.ts'),
      createAppRuntimeConfig(app, config.workspace.packageScope, remotes),
    );
    if ((app.verticalRefs?.length ?? 0) > 0) {
      for (const worker of [false, true]) {
        migrateGeneratedProviderImports(
          io,
          path.join(
            io.workspaceRoot,
            app.directory,
            `src/federated-components${worker ? '.worker' : ''}.tsx`,
          ),
          createFederatedComponentsRegistry(
            config.workspace.packageScope,
            app,
            remotes,
            worker,
          ),
        );
      }
    }
    if (app.kind === 'shell') {
      const uiRemotes = resolveRemoteRefs(app, remotes).filter(
        appEmitsBrowserUi,
      );
      for (const worker of [false, true]) {
        migrateGeneratedProviderImports(
          io,
          path.join(
            io.workspaceRoot,
            app.directory,
            `src/routes/vertical-components${worker ? '.worker' : ''}.tsx`,
          ),
          worker
            ? createShellWorkerRemoteComponents(app, uiRemotes)
            : createShellRemoteComponents(app, uiRemotes),
        );
      }
    } else {
      for (const expose of distributedSsrExposes(app)) {
        migrateGeneratedProviderImports(
          io,
          path.join(
            io.workspaceRoot,
            app.directory,
            'src/routes/[lang]/_mf/fragment',
            distributedSsrFragmentSlug(expose),
            'page.tsx',
          ),
          createRemoteExposeFragmentPage(app, expose),
        );
      }
    }
  }

  updateGeneratedShellRuntimeSurfaces(io, config);
  updateGeneratedProductRouteAdapters(io, config);
  updateGeneratedNavigationSurfaces(io, config);
}
