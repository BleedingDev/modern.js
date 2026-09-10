import path from 'node:path';
import type { AppTools } from '@modern-js/app-tools';
import { createPluginManager } from '@modern-js/plugin';
import { createContext, initPluginAPI } from '@modern-js/plugin/cli';
import { bffPlugin as nativeBffPlugin } from '../../plugin-bff/src/cli';
import { bffPlugin } from '../src';

rstest.mock('@modern-js/plugin-bff', () => ({
  bffPlugin: nativeBffPlugin,
  default: nativeBffPlugin,
}));
rstest.mock('effect', () => {
  throw new Error('optional Effect peer was loaded by Hono');
});
rstest.mock('@effect/opentelemetry', () => {
  throw new Error('optional Effect telemetry was loaded by Hono');
});
rstest.mock('@modern-js/plugin-bff-extensions/client-generator', () => {
  throw new Error('Effect codegen was loaded by Hono');
});

test('Hono composition registers native hooks without resolving or importing Effect', async () => {
  const manager = createPluginManager();
  manager.addPlugins([bffPlugin()]);
  const plugins = manager.getPlugins();
  const config = {
    bff: { runtimeFramework: 'hono' },
    source: {},
    output: {},
    server: {},
  };
  const context = await createContext<AppTools>({
    appContext: {
      appDirectory: __dirname,
      apiDirectory: path.join(__dirname, 'api'),
      lambdaDirectory: path.join(__dirname, 'api/lambda'),
      plugins,
    } as never,
    config: config as never,
    normalizedConfig: config as never,
  });
  const api = initPluginAPI<AppTools>({ context, pluginManager: manager });
  for (const plugin of plugins) await plugin.setup?.(api);
  const descriptors = await api
    .getHooks()
    ._internalServerPlugins.call({ plugins: [] });
  expect(descriptors.plugins).toEqual([
    {
      name: '@modern-js/plugin-bff/server-plugin',
      options: {
        runtimeAdapters: {
          effect: '@modern-js/plugin-bff-extensions/effect-adapter',
        },
        honoRouteBinder: '@modern-js/plugin-bff-extensions/hono/node',
      },
    },
  ]);
  await api.getHooks().modifyBundlerChain.call(
    {} as never,
    {
      isServer: false,
      CHAIN_ID: { RULE: { JS: 'js' } },
    } as never,
  );
  const configurations = await api.getHooks().config.call();
  expect(configurations).toContainEqual({
    bff: {
      requestCreator: '@modern-js/runtime-extensions/request-policy',
      runtimeCreateRequest: '@modern-js/runtime-extensions/request-policy',
      clientCodegenPlugin: require.resolve(
        '@modern-js/plugin-bff-build-extensions/hono-client-codegen',
      ),
    },
  });
  expect(api.getAppContext().bffRuntimeFramework).toBe('hono');
});

describe('optional Effect peer', () => {
  test('loads the base BFF CLI without evaluating Effect', async () => {
    await expect(import('../../plugin-bff/src/cli')).resolves.toEqual(
      expect.objectContaining({
        bffPlugin: expect.any(Function),
      }),
    );
  });
});
