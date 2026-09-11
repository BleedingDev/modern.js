import os from 'node:os';
import path from 'node:path';
import type { AppTools } from '@modern-js/app-tools';
import {
  type Plugin as BasePlugin,
  createPluginManager,
} from '@modern-js/plugin';
import { createContext, initPluginAPI } from '@modern-js/plugin/cli';
import { server } from '@modern-js/plugin/server';
import {
  type APIServerStartInput,
  compatPlugin,
  handleSetupResult,
  type ServerPlugin,
} from '@modern-js/server-core';
import type { ServerNodeMiddleware } from '@modern-js/server-core/node';
import { fs } from '@modern-js/utils';
import { bffPlugin as nativeBffPlugin } from '../../plugin-bff/src/cli';
import plugin, {
  type BffServerPluginOptions,
} from '../../plugin-bff/src/server';
import { bffPlugin } from '../src';

rstest.mock('@modern-js/plugin-bff', () => ({
  bffPlugin: nativeBffPlugin,
  default: nativeBffPlugin,
}));

async function configuredServerOptions(appDirectory: string) {
  const manager = createPluginManager();
  manager.addPlugins([bffPlugin()]);
  const plugins = manager.getPlugins();
  const config = { bff: {}, source: {}, output: {}, server: {} };
  const context = await createContext<AppTools>({
    appContext: {
      appDirectory,
      apiDirectory: path.join(appDirectory, 'api'),
      lambdaDirectory: path.join(appDirectory, 'api/lambda'),
      plugins,
    } as never,
    config: config as never,
    normalizedConfig: config as never,
  });
  const api = initPluginAPI<AppTools>({ context, pluginManager: manager });
  for (const item of plugins) await item.setup?.(api);
  const configured = await api
    .getHooks()
    ._internalServerPlugins.call({ plugins: [] });
  return JSON.parse(
    JSON.stringify(configured.plugins[0]!.options),
  ) as BffServerPluginOptions;
}

test('CLI-composed Effect server registers every configured prefix after serializing its options', async () => {
  let effectPaths: string[] = [];
  let apiHandlerInfos: unknown;
  const observer: ServerPlugin = {
    name: 'observe-effect-prefixes',
    setup(api) {
      api.prepareApiServer((async (
        input: APIServerStartInput,
        next: (input: APIServerStartInput) => Promise<ServerNodeMiddleware>,
      ) => {
        apiHandlerInfos = api.getServerContext().apiHandlerInfos;
        return next(input);
      }) as never);
      api.onPrepare(() => {
        effectPaths = api
          .getServerContext()
          .middlewares.filter(
            middleware => middleware.name === 'effect-api-handler',
          )
          .map(middleware => middleware.path ?? '');
      });
    },
  };
  const appDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'bff-server-app-'),
  );
  try {
    await fs.outputJSON(path.join(appDirectory, 'package.json'), {
      private: true,
      dependencies: { '@modern-js/plugin-bff-extensions': '3.8.3' },
    });
    await fs.ensureSymlink(
      path.resolve(__dirname, '../../plugin-bff-extensions'),
      path.join(appDirectory, 'node_modules/@modern-js/plugin-bff-extensions'),
      'dir',
    );
    const options = await configuredServerOptions(appDirectory);
    const { serverContext } = await server.run({
      plugins: [compatPlugin(), plugin(options), observer] as BasePlugin[],
      options: {
        appContext: {
          appDirectory,
          apiDirectory: path.resolve(appDirectory, 'missing-api'),
          bffRuntimeFramework: 'effect',
          middlewares: [],
        },
        pwd: process.cwd(),
      },
      config: { bff: { prefix: ['/api', '/rpc'] } },
      handleSetupResult,
    });
    const hooks = serverContext.pluginAPI!.getHooks();
    await hooks.prepareApiServer.call({ pwd: appDirectory, prefix: '/' });
    expect(apiHandlerInfos).toBeUndefined();
    await hooks.onPrepare.call();
    expect(effectPaths).toEqual(['/api/*', '/rpc/*']);
  } finally {
    await fs.remove(appDirectory);
  }
});

test.each([
  'commonjs',
  'module',
] as const)('loads only the selected %s adapter lazily from the application', async moduleType => {
  const appDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'bff-lazy-adapter-'),
  );
  try {
    const adapterDirectory = path.join(
      appDirectory,
      'node_modules/fixture-adapter',
    );
    const receipt = path.join(appDirectory, 'receipt.json');
    await fs.outputJSON(path.join(adapterDirectory, 'package.json'), {
      name: 'fixture-adapter',
      type: moduleType,
      exports: './index.js',
    });
    const source = `${moduleType === 'commonjs' ? "const fs = require('node:fs');" : "import * as fs from 'node:fs';"}
fs.writeFileSync(${JSON.stringify(receipt)}, '"loaded"');
${moduleType === 'commonjs' ? 'exports.createRuntimeAdapters =' : 'export const createRuntimeAdapters ='} () => [{
  registerMiddleware: async options => fs.writeFileSync(${JSON.stringify(receipt)}, JSON.stringify(options))
}];`;
    await fs.outputFile(path.join(adapterDirectory, 'index.js'), source);
    const { serverContext } = await server.run({
      plugins: [
        compatPlugin(),
        plugin({
          runtimeAdapters: { effect: 'fixture-adapter' },
          honoRouteBinder: 'must-not-resolve-in-effect-mode',
        }),
      ] as BasePlugin[],
      options: {
        appContext: {
          appDirectory,
          bffRuntimeFramework: 'effect',
          middlewares: [],
        },
        pwd: appDirectory,
      },
      config: { bff: { prefix: ['/api', '/rpc'] } },
      handleSetupResult,
    });
    expect(await fs.pathExists(receipt)).toBe(false);
    await serverContext.pluginAPI!.getHooks().onPrepare.call();
    expect(await fs.readJSON(receipt)).toEqual({ prefix: ['/api', '/rpc'] });
  } finally {
    await fs.remove(appDirectory);
  }
});
