import type { AppTools, CliPlugin } from '@modern-js/app-tools';
import {
  applyLocalisedUrlsToRoutes,
  resolveLocalisedUrlsConfig,
} from '@modern-js/i18n-runtime-extensions';
import type { NestedRouteForCli, PageRoute } from '@modern-js/types';
import type { I18nPluginOptions } from './options';

const runtimePaths = new Map([
  ['@modern-js/plugin-i18n/runtime', '@modern-js/i18n-integration/runtime'],
  [
    '@modern-js/plugin-i18n/runtime/no-react-i18next',
    '@modern-js/i18n-integration/runtime/no-react-i18next',
  ],
]);
const integrationRuntimePaths = new Set(runtimePaths.values());

/** Compose fork policy with the native plugin's own descriptor generation. */
export const ultramodernI18nIntegrationPlugin = (): CliPlugin<AppTools> => ({
  name: '@modern-js/i18n-integration',
  pre: ['@modern-js/plugin-i18n'],
  setup(api) {
    api._internalRuntimePlugins(({ entrypoint, plugins }) => ({
      entrypoint,
      plugins: plugins.map(plugin => {
        const path = runtimePaths.get(plugin.path);
        return path ? { ...plugin, path } : plugin;
      }),
    }));

    // The native server plugin derives its URL policy from
    // `localeDetection.localisedUrls` on its own, so the descriptor is left
    // alone. Rewriting it to `@modern-js/i18n-integration/server` would make
    // the server unbootable for an app that only declares
    // `@modern-js/ultramodern-app-tools`.

    api.modifyFileSystemRoutes(async ({ entrypoint, routes }) => {
      // Route generation may precede runtime module generation. Resolve the
      // native descriptor with a fresh local output list; this hook never calls
      // route generation and cannot append to a later emitted descriptor list.
      const { plugins } = await api.getHooks()._internalRuntimePlugins.call({
        entrypoint,
        plugins: [],
      });
      const descriptor = plugins.find(plugin =>
        integrationRuntimePaths.has(plugin.path),
      );
      const config = descriptor?.config as I18nPluginOptions | undefined;
      const {
        localePathRedirect,
        languages = [],
        localisedUrls,
      } = config?.localeDetection ?? {};
      const resolved = resolveLocalisedUrlsConfig(localisedUrls);
      if (!localePathRedirect || !languages.length || !resolved.enabled) {
        return { entrypoint, routes };
      }
      return {
        entrypoint,
        routes: applyLocalisedUrlsToRoutes(
          routes as (NestedRouteForCli | PageRoute)[],
          languages,
          resolved.map,
        ) as (NestedRouteForCli | PageRoute)[],
      };
    });
  },
});

export default ultramodernI18nIntegrationPlugin;
