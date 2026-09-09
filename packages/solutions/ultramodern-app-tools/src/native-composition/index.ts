import { type AppTools, appTools, type CliPlugin } from '@modern-js/app-tools';
import backendFederationBuildPlugin from '@modern-js/app-tools-extensions/backend-federation-build';
import { createCloudflareBuilderPlugin } from '@modern-js/app-tools-extensions/cloudflare-builder';
import { createDeployOutputAliasesPlugin } from '@modern-js/app-tools-extensions/deploy-output/plugin';
import { ultramodernReleaseEnvelopePlugin } from './release-envelope-plugin';

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
    backendFederationBuildPlugin(),
    createCloudflareBuilderPlugin(),
    createDeployOutputAliasesPlugin(),
    ultramodernReleaseEnvelopePlugin(),
  ],
  setup(api) {
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
