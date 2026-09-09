import { type AppTools, appTools, type CliPlugin } from '@modern-js/app-tools';
import backendFederationBuildPlugin from '@modern-js/app-tools-extensions/backend-federation-build';
import { createCloudflareBuilderPlugin } from '@modern-js/app-tools-extensions/cloudflare-builder';
import { createDeployOutputAliasesPlugin } from '@modern-js/app-tools-extensions/deploy-output/plugin';
import { ultramodernI18nIntegrationPlugin } from '@modern-js/i18n-integration';
import { ultramodernReleaseEnvelopePlugin } from './release-envelope-plugin';
import { ultramodernRouterIntegrationPlugin } from './router-integration-plugin';
import { rscDisabledRuntimePlugin } from './rsc-disabled-plugin';
import { ultramodernSSRIntegrationPlugin } from './ssr-integration-plugin';

export {
  createPresetUltramodernConfig,
  type PresetUltramodernOptions,
  presetUltramodern,
} from './preset';
export { ultramodernReleaseEnvelopePlugin } from './release-envelope-plugin';
export type { AppUserConfig, UltramodernAppUserConfig } from './types';

/** Compose the fork's build and release features through native CLI plugins. */
export const ultramodernAppTools = (): CliPlugin<AppTools> => ({
  name: '@modern-js/ultramodern-app-tools',
  usePlugins: [
    appTools(),
    ultramodernI18nIntegrationPlugin(),
    ultramodernRouterIntegrationPlugin(),
    ultramodernSSRIntegrationPlugin(),
    backendFederationBuildPlugin(),
    createCloudflareBuilderPlugin(),
    createDeployOutputAliasesPlugin(),
    ultramodernReleaseEnvelopePlugin(),
  ],
  setup(api) {
    api.modifyResolvedConfig(config => {
      if (config.server?.rsc) return config;
      return {
        ...config,
        builderPlugins: [
          ...(config.builderPlugins ?? []),
          rscDisabledRuntimePlugin(),
        ],
      };
    });
    api._internalServerPlugins(({ plugins }) => {
      const name = '@modern-js/ultramodern-app-tools/server-plugin';
      if (!plugins.some(plugin => plugin.name === name)) {
        plugins.push({ name });
      }
      return { plugins };
    });
    api._internalRuntimePlugins(({ entrypoint, plugins }) => {
      plugins.push({
        name: 'rendererHead',
        path: '@modern-js/runtime-renderer-extensions',
        config: {},
      });
      return { entrypoint, plugins };
    });
  },
});
