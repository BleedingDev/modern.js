import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BffGeneratedEntries, BffGeneration } from '@modern-js/app-tools';
import { bffPlugin as nativeBffPlugin } from '../../plugin-bff/src/cli';
import { createProducerClient } from '../../plugin-bff-extensions/src/cross-project-policy/producer-runtime';
import { type BffGenerationMetadata } from '../src/client-artifacts';
import { registerBffGeneratedEntries } from '../src/generated-entries';

const require = createRequire(import.meta.url);

async function render(
  appDirectory: string,
  moduleType: 'commonjs' | 'module' = 'commonjs',
  runtimeCreateRequest?: string,
) {
  const hooks = nativeBffPlugin().registryHooks!;
  const generation: BffGeneration = {
    appDirectory,
    apiDirectory: path.join(appDirectory, 'api'),
    lambdaDirectory: path.join(appDirectory, 'api/lambda'),
    existLambda: false,
    apiFiles: [],
    relativeDistPath: 'dist',
    prefix: '/api',
    requestId: 'runtime-app',
  };
  const metadata = new WeakMap<BffGeneration, BffGenerationMetadata>();
  metadata.set(generation, {
    runtimeFramework: 'hono',
    relativeEffectEntry: '',
    operationContracts: {
      'GET:/api/ping': { schemaHash: 'generated', operationVersion: 1 },
    },
  });
  registerBffGeneratedEntries(
    {
      getAppContext: () => ({ moduleType }),
      getNormalizedConfig: () => ({ bff: { runtimeCreateRequest } }),
      modifyBffGeneratedEntries: hooks.modifyBffGeneratedEntries.tap,
    } as never,
    metadata,
  );
  return hooks.modifyBffGeneratedEntries.call({
    generation,
    plugin: { code: '', declaration: '' },
    runtime: { code: '', declaration: '' },
    packageDependencies: {},
  }) as Promise<BffGeneratedEntries>;
}

describe('fork producer generated entries', () => {
  test('emitted bootstrap invokes the owning defaults helper and preserves nested overrides', async () => {
    const appDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'bff-render-'),
    );
    try {
      await fs.promises.writeFile(
        path.join(appDirectory, 'package.json'),
        JSON.stringify({
          name: 'runtime-app',
          devDependencies: {
            '@modern-js/plugin-bff-build-extensions': '3.8.3',
            '@modern-js/plugin-bff-extensions': '3.8.3',
          },
        }),
      );
      const entries = await render(
        appDirectory,
        'commonjs',
        '@fixture/request',
      );
      const exports: Record<string, any> = {};
      const load = (name: string) => {
        if (name === '@fixture/request')
          return { configure: (options: unknown) => options };
        if (name === '@modern-js/plugin-bff-extensions/producer-runtime')
          return { createProducerClient };
        throw new Error(`Unexpected generated import ${name}`);
      };
      new Function('require', 'exports', entries.runtime.code)(load, exports);
      expect(exports.configure).toBe(exports.initProducerClient);
      expect(
        exports.configure({
          requestId: 'override',
          identityBinding: { strict: false },
          operationContract: { requireSchemaHash: false },
        }),
      ).toEqual({
        requestId: 'override',
        requireEnvelope: true,
        identityBinding: { enabled: true, strict: false },
        operationContract: {
          enabled: true,
          strict: true,
          requireSchemaHash: false,
          requireOperationVersion: true,
        },
      });
    } finally {
      await fs.promises.rm(appDirectory, { recursive: true, force: true });
    }
  });

  test.each([
    'commonjs',
    'module',
  ] as const)('published %s producer modules load with actual package exports', async moduleType => {
    const appDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'bff-published-'),
    );
    try {
      await fs.promises.writeFile(
        path.join(appDirectory, 'package.json'),
        JSON.stringify({ name: 'runtime-app', type: moduleType }),
      );
      for (const name of [
        'plugin-bff-build-extensions',
        'plugin-bff-extensions',
      ]) {
        const target = path.join(appDirectory, 'node_modules/@modern-js', name);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.symlink(
          path.resolve(__dirname, '../..', name),
          target,
          process.platform === 'win32' ? 'junction' : 'dir',
        );
      }
      const requestModule = path.join(appDirectory, 'request.mjs');
      await fs.promises.writeFile(
        requestModule,
        'export const configure = options => options;',
      );
      const entries = await render(appDirectory, moduleType, requestModule);
      if (moduleType === 'module')
        expect(entries.runtime.code).toContain(
          JSON.stringify(pathToFileURL(requestModule).href),
        );
      const runtimeFile = path.join(appDirectory, 'runtime.js');
      const pluginFile = path.join(appDirectory, 'plugin.js');
      await fs.promises.writeFile(runtimeFile, entries.runtime.code);
      await fs.promises.writeFile(pluginFile, entries.plugin.code);
      const runtime = await import(
        /* webpackIgnore: true */ pathToFileURL(runtimeFile).href
      );
      const plugin = await import(
        /* webpackIgnore: true */ pathToFileURL(pluginFile).href
      );
      expect(runtime.configure).toBe(runtime.initProducerClient);
      expect(runtime.configure()).toMatchObject({
        requestId: 'runtime-app',
        requireEnvelope: true,
      });
      expect(plugin.crossProjectApiPlugin().name).toBe(
        '@modern-js/plugin-independent-bff',
      );
    } finally {
      await fs.promises.rm(appDirectory, { recursive: true, force: true });
    }
  });
});
