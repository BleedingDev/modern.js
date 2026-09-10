import {
  createRouterPlugin,
  type RouterProviderFactory,
} from '@modern-js/runtime-extensions/router-provider';
import { rstest } from '@rstest/core';
import { routerProviderRegistryHooks } from '../../src/router/runtime/hooks';

async function nativeProvider() {
  (globalThis as any).__webpack_require__ = {
    u: (chunkId: unknown) => String(chunkId),
  };
  const { routerPlugin } = await import('../../src/router/runtime/internal');
  return routerPlugin;
}

describe('native provider and injected fork composition', () => {
  it('exports the native provider directly', async () => {
    const factory = await nativeProvider();
    const { routerPlugin } = await import('../../src/router/runtime/plugin');
    expect(factory).toBe(routerPlugin);
  });

  it('binds each wrapper to its local provider and canonical hook registry', async () => {
    const factory = await nativeProvider();
    const setupA = rstest.fn();
    const setupB = rstest.fn();
    const factoryA = rstest.fn(() => ({
      setup: setupA,
    })) as RouterProviderFactory;
    const factoryB = rstest.fn(() => ({
      setup: setupB,
    })) as RouterProviderFactory;
    const wrapper = (localFactory: RouterProviderFactory) =>
      createRouterPlugin({
        defaultProvider: { name: 'react-router', factory },
        registryHooks: routerProviderRegistryHooks,
        localProviders: [{ name: 'tanstack', factory: localFactory }],
      });
    const apiA = {
      getRuntimeConfig: () => ({ router: { framework: 'tanstack' } }),
    };
    const apiB = {
      getRuntimeConfig: () => ({ router: { framework: 'tanstack' } }),
    };
    const pluginA = wrapper(factoryA)();
    expect(pluginA.registryHooks).toBe(routerProviderRegistryHooks);
    pluginA.setup(apiA);
    wrapper(factoryB)().setup(apiB);
    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
    expect(setupA).toHaveBeenCalledWith(apiA);
    expect(setupB).toHaveBeenCalledWith(apiB);
  });

  it('rejects a provider missing from the local realm', async () => {
    const factory = await nativeProvider();
    const wrapper = createRouterPlugin({
      defaultProvider: { name: 'react-router', factory },
      registryHooks: routerProviderRegistryHooks,
    });
    expect(() =>
      wrapper().setup({
        getRuntimeConfig: () => ({ router: { framework: 'tanstack' } }),
      }),
    ).toThrow(/not registered in the app-owned router provider realm/);
  });
});
