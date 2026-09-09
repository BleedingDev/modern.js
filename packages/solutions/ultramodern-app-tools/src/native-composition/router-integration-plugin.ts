import type { AppTools, CliPlugin } from '@modern-js/app-tools';

/** Add fork router policy after the native and optional provider selectors. */
export const ultramodernRouterIntegrationPlugin = (): CliPlugin<AppTools> => ({
  name: '@modern-js/ultramodern-router-integration',
  pre: ['@modern-js/plugin-router', '@modern-js/plugin-tanstack'],
  setup(api) {
    api._internalRuntimePlugins(({ entrypoint, plugins }) => ({
      entrypoint,
      plugins: plugins.map(plugin =>
        plugin.path === '@modern-js/runtime/router/internal'
          ? {
              ...plugin,
              path: '@modern-js/ultramodern-app-tools/router-runtime',
            }
          : plugin,
      ),
    }));
  },
});
