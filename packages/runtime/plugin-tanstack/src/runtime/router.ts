/** App-local composition for custom entries using runtime router selection. */
import { routerProviderRegistryHooks } from '@modern-js/runtime/context';
import { routerPlugin as nativeRouterPlugin } from '@modern-js/runtime/router/internal';
import { createRouterPlugin } from '@modern-js/runtime-extensions/router-provider';
import { createRouterStatePlugin } from '@modern-js/runtime-extensions/router-state-plugin';
import { tanstackRouterProviderFactory } from './register';

const createProviderPlugin = createRouterPlugin({
  defaultProvider: { name: 'react-router', factory: nativeRouterPlugin },
  registryHooks: routerProviderRegistryHooks,
  localProviders: [
    { name: 'tanstack', factory: tanstackRouterProviderFactory },
  ],
});
const statePlugin = createRouterStatePlugin({
  registryHooks: routerProviderRegistryHooks,
});

export const routerPlugin: typeof nativeRouterPlugin = (userConfig = {}) => {
  const providerPlugin = createProviderPlugin(userConfig);
  return {
    ...providerPlugin,
    setup(api) {
      statePlugin.setup(api);
      providerPlugin.setup(api);
    },
  };
};
