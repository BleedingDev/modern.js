import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const packageDirectory = path.resolve(__dirname, '../..');
const requireFromPackage = createRequire(
  path.join(packageDirectory, 'package.json'),
);

test.each([
  false,
  true,
])('validates exact runtime names through emitted declarations (fork integration: %s)', integrated => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-server-config-types-'),
  );
  try {
    const scope = path.join(directory, 'node_modules/@modern-js');
    fs.mkdirSync(scope, { recursive: true });
    const names = ['plugin', 'server-core', 'app-tools'];
    if (integrated)
      names.push('server-runtime-extensions', 'ultramodern-app-tools');
    for (const name of names) {
      const root =
        name === 'ultramodern-app-tools'
          ? packageDirectory
          : path.join(packageDirectory, 'node_modules/@modern-js', name);
      fs.symlinkSync(root, path.join(scope, name), 'dir');
    }
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ type: 'module', private: true }),
    );
    const nativeSource = `
import type { BffRuntimeFramework, ServerCreateOptions } from '@modern-js/plugin/server';
import type { BffUserConfig, ServerPluginAPI } from '@modern-js/server-core';
import type { AppToolsContext, AppToolsAPI, AppUserConfig as NativeAppUserConfig } from '@modern-js/app-tools';

type ExpectedRuntime = ${integrated ? "'hono' | 'effect'" : "'hono'"};
type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false;
type RuntimeOf<Config> = Config extends { runtimeFramework?: infer Runtime } ? NonNullable<Runtime> : never;
const exact: [
  Equal<BffRuntimeFramework, ExpectedRuntime>,
  Equal<NonNullable<BffUserConfig['runtimeFramework']>, ExpectedRuntime>,
  Equal<NonNullable<ServerCreateOptions['appContext']['bffRuntimeFramework']>, ExpectedRuntime>,
  Equal<NonNullable<ReturnType<ServerPluginAPI['getServerContext']>['bffRuntimeFramework']>, ExpectedRuntime>,
  Equal<NonNullable<AppToolsContext['bffRuntimeFramework']>, ExpectedRuntime>,
  Equal<NonNullable<ReturnType<AppToolsAPI['getAppContext']>['bffRuntimeFramework']>, ExpectedRuntime>,
  Equal<RuntimeOf<NonNullable<NativeAppUserConfig['bff']>>, ExpectedRuntime>
] = [true, true, true, true, true, true, true];
const nativeConfig: BffUserConfig = { runtimeFramework: 'hono' };
const nativeTransport: ServerCreateOptions['appContext'] = { bffRuntimeFramework: 'hono' };
void [exact, nativeConfig, nativeTransport];
// @ts-expect-error the registry rejects unknown runtime names
const invalidRegistry: BffRuntimeFramework = 'honoo';
// @ts-expect-error native config must not widen the registry to string
const invalidNativeConfig: BffUserConfig = { runtimeFramework: 'efffect' };
// @ts-expect-error the transport preserves the registry union
const invalidTransport: ServerCreateOptions['appContext'] = { bffRuntimeFramework: 'missing' };
// @ts-expect-error server plugin getters must not expose any or string
const invalidGetter: NonNullable<ReturnType<ServerPluginAPI['getServerContext']>['bffRuntimeFramework']> = 'other';
// @ts-expect-error CLI context must preserve finite runtime names
const invalidCliContext: AppToolsContext['bffRuntimeFramework'] = 'other';
// @ts-expect-error CLI getters must preserve finite runtime names
const invalidCliGetter: ReturnType<AppToolsAPI['getAppContext']>['bffRuntimeFramework'] = 'other';
// @ts-expect-error native config still rejects arbitrary fields
const invalidNativeField: BffUserConfig = { inventedOption: true };
`;
    const modeSource = integrated
      ? `
import type { AppUserConfig } from '@modern-js/ultramodern-app-tools';
import type { UltramodernBffUserConfig, UltramodernServerUserConfig } from '@modern-js/server-runtime-extensions/server-config';
import type { ServerUserConfig } from '@modern-js/server-core';
import '@modern-js/ultramodern-app-tools/server-plugin';
const config: AppUserConfig = {
  bff: {
    runtimeFramework: 'effect',
    effect: { entry: 'api/main', strictEffectApproach: true, dataPlatform: { enabled: true } },
    crossProjectPolicy: { enabled: true, expectedOperationContracts: { 'GET:/items': { schemaHash: 'v1' } } },
  },
  server: { telemetry: { enabled: true, service: 'consumer', slo: { queueDroppedWarnThreshold: 3 } } },
};
const bff: UltramodernBffUserConfig = config.bff!;
const server: UltramodernServerUserConfig = config.server!;
const extendedNative: BffUserConfig = { runtimeFramework: 'effect', effect: bff.effect };
const extendedTransport: ServerCreateOptions['appContext'] = { bffRuntimeFramework: 'effect' };
const extendedGetter: ReturnType<ServerPluginAPI['getServerContext']>['bffRuntimeFramework'] = 'effect';
const extendedCli: AppToolsContext['bffRuntimeFramework'] = 'effect';
const nativeServer: ServerUserConfig = { telemetry: server.telemetry };
const hono: AppUserConfig = { bff: { runtimeFramework: 'hono' } };
void [extendedNative, extendedTransport, extendedGetter, extendedCli, nativeServer, hono];
// @ts-expect-error integrated public config rejects unsupported names
const invalidFramework: AppUserConfig = { bff: { runtimeFramework: 'other' } };
// @ts-expect-error canonical Effect entry remains a string
const invalidEffect: AppUserConfig = { bff: { effect: { entry: 42 } } };
// @ts-expect-error telemetry retains canonical field types
const invalidTelemetry: AppUserConfig = { server: { telemetry: { samplingRate: 'all' } } };
`
      : `
// @ts-expect-error Effect is registered only by the fork integration
const unsupportedEffect: BffRuntimeFramework = 'effect';
// @ts-expect-error native config must not silently include fork runtimes
const unsupportedEffectConfig: BffUserConfig = { runtimeFramework: 'effect' };
// @ts-expect-error the native transport cannot select an unregistered runtime
const unsupportedEffectTransport: ServerCreateOptions['appContext'] = { bffRuntimeFramework: 'effect' };
// @ts-expect-error the native getter does not include fork runtime names
const unsupportedEffectGetter: ReturnType<ServerPluginAPI['getServerContext']>['bffRuntimeFramework'] = 'effect';
// @ts-expect-error native CLI context does not include fork runtime names
const unsupportedEffectCli: AppToolsContext['bffRuntimeFramework'] = 'effect';
`;
    fs.writeFileSync(
      path.join(directory, 'consumer.ts'),
      nativeSource + modeSource,
    );
    fs.writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'ES2022',
        },
        files: ['consumer.ts'],
      }),
    );
    const compilerRoot = path.dirname(
      requireFromPackage.resolve('@typescript/native-preview/package.json'),
    );
    const output = spawnSync(
      process.execPath,
      [
        path.join(compilerRoot, 'bin/tsgo'),
        '-p',
        path.join(directory, 'tsconfig.json'),
      ],
      { cwd: directory, encoding: 'utf8' },
    );
    if (output.status !== 0) {
      throw new Error(output.stdout + output.stderr, { cause: output.error });
    }
    expect(output.stdout).toBe('');
    expect(fs.readdirSync(scope).sort()).toEqual(names.sort());
    if (integrated) {
      const declaration = fs.readFileSync(
        path.join(
          scope,
          'server-runtime-extensions/dist/types/serverConfig.d.ts',
        ),
        'utf8',
      );
      expect(declaration).toMatch(
        /declare module ['"]@modern-js\/server-core['"]/,
      );
      expect(declaration).toMatch(
        /declare module ['"]@modern-js\/plugin\/server['"]/,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test.each([
  '.mts',
  '.cts',
])('keeps public plugin factory declarations callable from %s consumers', extension => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-plugin-factory-types-'),
  );
  try {
    const scope = path.join(directory, 'node_modules/@modern-js');
    fs.mkdirSync(scope, { recursive: true });
    fs.symlinkSync(
      packageDirectory,
      path.join(scope, 'ultramodern-app-tools'),
      'dir',
    );
    fs.symlinkSync(
      path.join(
        packageDirectory,
        'node_modules/@modern-js/server-runtime-extensions',
      ),
      path.join(scope, 'server-runtime-extensions'),
      'dir',
    );
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true }),
    );
    const fileName = `consumer${extension}`;
    fs.writeFileSync(
      path.join(directory, fileName),
      `
import serverPlugin from '@modern-js/ultramodern-app-tools/server-plugin';
import ownerServerPlugin from '@modern-js/server-runtime-extensions/server-plugin';
import routerPlugin from '@modern-js/ultramodern-app-tools/router-runtime';
import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';
const plugins = [serverPlugin(), ownerServerPlugin(), routerPlugin(), ultramodernAppTools()];
const names: Array<string | undefined> = plugins.map(plugin => plugin.name);
void names;
// @ts-expect-error public factory typing must not become any
serverPlugin({ unexpected: true });
// @ts-expect-error owner factory typing must not become any
ownerServerPlugin({ unexpected: true });
`,
    );
    fs.writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'ES2022',
        },
        files: [fileName],
      }),
    );
    const compilerRoot = path.dirname(
      requireFromPackage.resolve('@typescript/native-preview/package.json'),
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(compilerRoot, 'bin/tsgo'),
        '-p',
        path.join(directory, 'tsconfig.json'),
      ],
      { cwd: directory, encoding: 'utf8' },
    );
    if (result.status !== 0)
      throw new Error(result.stdout + result.stderr, { cause: result.error });
    expect(result.stdout).toBe('');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

// The router entry is bundled by router-integration.test.ts, like the native router.
test.each([
  'module',
  'commonjs',
])('loads and calls public plugin factories through real Node %s exports', moduleType => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-plugin-factory-runtime-'),
  );
  try {
    const scope = path.join(directory, 'node_modules/@modern-js');
    fs.mkdirSync(scope, { recursive: true });
    fs.symlinkSync(
      packageDirectory,
      path.join(scope, 'ultramodern-app-tools'),
      'dir',
    );
    fs.symlinkSync(
      path.join(
        packageDirectory,
        'node_modules/@modern-js/server-runtime-extensions',
      ),
      path.join(scope, 'server-runtime-extensions'),
      'dir',
    );
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: moduleType }),
    );
    const imports =
      moduleType === 'module'
        ? `
import serverPlugin from '@modern-js/ultramodern-app-tools/server-plugin';
import ownerServerPlugin from '@modern-js/server-runtime-extensions/server-plugin';
import { ultramodernAppTools } from '@modern-js/ultramodern-app-tools';
`
        : `
const { default: serverPlugin } = require('@modern-js/ultramodern-app-tools/server-plugin');
const { default: ownerServerPlugin } = require('@modern-js/server-runtime-extensions/server-plugin');
const { ultramodernAppTools } = require('@modern-js/ultramodern-app-tools');
`;
    const source =
      imports +
      `
const factories = [serverPlugin, ownerServerPlugin, ultramodernAppTools];
process.stdout.write(JSON.stringify(factories.map(factory => ({ type: typeof factory, name: factory().name }))));
`;
    const entry = path.join(
      directory,
      moduleType === 'module' ? 'consumer.mjs' : 'consumer.cjs',
    );
    fs.writeFileSync(entry, source);
    const result = spawnSync(process.execPath, [entry], {
      cwd: directory,
      encoding: 'utf8',
    });
    if (result.status !== 0)
      throw new Error(result.stdout + result.stderr, { cause: result.error });
    const factories = JSON.parse(result.stdout) as Array<{
      type: string;
      name: string;
    }>;
    expect(factories).toHaveLength(3);
    expect(factories.every(factory => factory.type === 'function')).toBe(true);
    expect(factories[0].name).toBe('@modern-js/ultramodern-server');
    expect(factories[1].name).toBe('@modern-js/ultramodern-server');
    expect(factories[2].name).toBe('@modern-js/ultramodern-app-tools');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
