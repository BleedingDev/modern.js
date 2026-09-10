import {
  routerPlugin as nativeRouterPlugin,
  routerProviderRegistryHooks,
} from '@modern-js/runtime/router/internal';
import { createRouterPlugin } from '@modern-js/runtime-extensions/router-provider';
import { createRouterStatePlugin } from '@modern-js/runtime-extensions/router-state-plugin';

const createProvider = createRouterPlugin({
  defaultProvider: { name: 'react-router', factory: nativeRouterPlugin },
  registryHooks: routerProviderRegistryHooks,
});

/** Install fork observers before the native provider registers its lifecycle. */
export const routerPlugin: typeof nativeRouterPlugin = config => {
  const state = createRouterStatePlugin({
    registryHooks: routerProviderRegistryHooks,
  });
  const provider = createProvider(config);
  return {
    ...provider,
    setup(api) {
      state.setup?.(api);
      return provider.setup?.(api);
    },
  };
};

export default routerPlugin;
