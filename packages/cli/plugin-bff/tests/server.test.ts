import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import type { Plugin as BasePlugin } from '@modern-js/plugin';
import { server } from '@modern-js/plugin/server';
import {
  compatPlugin,
  handleSetupResult,
  type ServerConfig,
  type ServerPlugin,
} from '@modern-js/server-core';
import { assign } from '@modern-js/utils/lodash';
import path from 'path';
import plugin, { type BffServerPluginOptions } from '../src/server';

declare module '@modern-js/plugin/server' {
  interface BffRuntimeRegistry {
    fixture: true;
  }
}

const invalidOptions: BffServerPluginOptions = {
  // @ts-expect-error Runtime adapter keys remain a finite registry.
  runtimeAdapters: { unknownRuntime: 'unknown-module' },
};
void invalidOptions;

const noop = () => {};

const pwd = path.resolve(__dirname, './fixtures/function');

export async function serverInit({
  plugins,
  serverConfig,
  appContext,
}: {
  plugins?: ServerPlugin[];
  serverConfig?: ServerConfig;
  appContext?: Record<string, unknown>;
}) {
  const { serverContext } = await server.run({
    plugins: [compatPlugin(), ...(plugins || [])] as BasePlugin[],
    options: {
      appContext: {
        bffRuntimeFramework: 'hono',
        ...(appContext || {}),
      },
      pwd: process.cwd(),
    },
    config: assign(
      {},
      {
        dev: {},
        output: {},
        source: {},
        tools: {},
        server: {},
        html: {},
        bff: {},
        security: {},
      },
      serverConfig,
    ),
    handleSetupResult,
  });

  const hooks = serverContext.pluginAPI?.getHooks();
  return hooks as any;
}

describe('bff server plugin', () => {
  describe('prepareApiServer', () => {
    it('should work well', async () => {
      let apiHandlerInfos = null;
      const mockApiPlugin: ServerPlugin = {
        name: 'mock-api',

        setup(api) {
          api.prepareApiServer(((input: any, next: any) => {
            const appContext = api.getServerContext();
            apiHandlerInfos = appContext.apiHandlerInfos;
            return next(input);
          }) as any);
        },
      };

      const hooks = await serverInit({
        plugins: [plugin(), mockApiPlugin],
      });

      await hooks.prepareApiServer.call({
        pwd,
        prefix: '/',
      });

      expect(apiHandlerInfos).toMatchSnapshot();
    });

    it('should work well with prefix', async () => {
      let apiHandlerInfos = null;

      const mockApiPlugin: ServerPlugin = {
        name: 'mock-api',

        setup(api) {
          api.prepareApiServer(((input: any, next: any) => {
            const appContext = api.getServerContext();
            apiHandlerInfos = appContext.apiHandlerInfos;
            return next(input);
          }) as any);
        },
      };

      const hooks = await serverInit({
        plugins: [plugin(), mockApiPlugin],
      });

      await hooks.prepareApiServer.call({ pwd, prefix: '/api' });
      expect(apiHandlerInfos).toMatchSnapshot();
    });

    it('should use native Hono when runtime framework is unresolved', async () => {
      let apiHandlerInfos: Array<{ routePath: string }> | null = null;
      const mockApiPlugin: ServerPlugin = {
        name: 'mock-api',
        setup(api) {
          api.prepareApiServer(((input: any, next: any) => {
            const appContext = api.getServerContext();
            apiHandlerInfos = appContext.apiHandlerInfos;
            return next(input);
          }) as any);
        },
      };

      const hooks = await serverInit({
        plugins: [plugin(), mockApiPlugin],
        appContext: {
          bffRuntimeFramework: undefined,
        },
      });

      await hooks.prepareApiServer.call({ pwd, prefix: '/' });
      expect(apiHandlerInfos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ routePath: expect.any(String) }),
        ]),
      );
    });
  });
  it('rejects an unregistered runtime instead of selecting another adapter', async () => {
    await expect(
      serverInit({
        plugins: [plugin()],
        appContext: { bffRuntimeFramework: 'fixture' },
      }),
    ).rejects.toThrow('No BFF runtime adapter is registered for "fixture"');
  });

  it('never resolves extension modules while preparing native Hono handlers', async () => {
    const hooks = await serverInit({
      plugins: [
        plugin({
          runtimeAdapters: { fixture: 'a-module-that-does-not-exist' },
        }),
      ],
    });
    await expect(
      hooks.prepareApiServer.call({ pwd, prefix: '/' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['module.exports = {};', 'must export createRuntimeAdapters'],
    ['exports.createRuntimeAdapters = () => [];', 'returned invalid adapters'],
    [
      'exports.createRuntimeAdapters = () => [{}];',
      'returned invalid adapters',
    ],
  ])('rejects a malformed adapter module: %s', async (source, message) => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'native-bff-adapter-'),
    );
    try {
      const entry = path.join(directory, 'adapter.cjs');
      await writeFile(entry, source);
      const hooks = await serverInit({
        plugins: [plugin({ runtimeAdapters: { fixture: entry } })],
        appContext: { bffRuntimeFramework: 'fixture', middlewares: [] },
      });
      await expect(hooks.onPrepare.call()).rejects.toThrow(message);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
