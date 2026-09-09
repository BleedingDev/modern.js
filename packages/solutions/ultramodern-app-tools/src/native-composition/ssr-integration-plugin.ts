// @effect-diagnostics globalConsole:off processEnv:off strictBooleanExpressions:off
import type {
  AppTools,
  AppToolsNormalizedConfig,
  CliPlugin,
  ServerUserConfig,
} from '@modern-js/app-tools';
import type { CLIPluginAPI } from '@modern-js/plugin';
import type { MergedEnvironmentConfig, RsbuildPlugin } from '@rsbuild/core';

type RsbuildRspackPluginLike =
  | string
  | ((...args: any[]) => any)
  | {
      name?: string;
      constructor?: {
        name?: string;
      };
    }
  | [unknown, ...unknown[]];

type EnvironmentConfigLike = Partial<
  Pick<MergedEnvironmentConfig, 'output' | 'source' | 'tools'>
>;

const getRspackPlugins = (rspackConfig: unknown): RsbuildRspackPluginLike[] => {
  if (!rspackConfig) {
    return [];
  }

  const rspackEntries = Array.isArray(rspackConfig)
    ? rspackConfig
    : [rspackConfig];
  const plugins: RsbuildRspackPluginLike[] = [];

  for (const entry of rspackEntries) {
    if (!entry || typeof entry === 'function' || typeof entry !== 'object') {
      continue;
    }

    const maybePlugins = (entry as { plugins?: unknown }).plugins;

    if (!Array.isArray(maybePlugins)) {
      continue;
    }

    for (const plugin of maybePlugins) {
      if (plugin) {
        plugins.push(plugin as RsbuildRspackPluginLike);
      }
    }
  }

  return plugins;
};

const getRspackPluginName = (
  plugin: RsbuildRspackPluginLike,
): string | undefined => {
  if (typeof plugin === 'string') {
    return plugin;
  }

  if (typeof plugin === 'function') {
    return plugin.name;
  }

  if (Array.isArray(plugin)) {
    const [first] = plugin;

    if (!first) {
      return undefined;
    }

    if (typeof first === 'string') {
      return first;
    }

    if (typeof first === 'function') {
      return first.name;
    }

    if (typeof first === 'object') {
      return (
        (first as { name?: string }).name ||
        (first as { constructor?: { name?: string } }).constructor?.name
      );
    }

    return undefined;
  }

  return plugin.name || plugin.constructor?.name;
};

const hasServerRenderingConfig = (
  userConfig: AppToolsNormalizedConfig,
): boolean => {
  const { output, server } = userConfig;

  if (output?.ssg) {
    return true;
  }

  if (output?.ssgByEntries && Object.keys(output.ssgByEntries).length > 0) {
    return true;
  }

  if (server?.ssr) {
    return true;
  }

  if (server?.ssrByEntries && Object.keys(server.ssrByEntries).length > 0) {
    return true;
  }

  return false;
};

const isModuleFederationAppSSREnabledInConfig = (
  ssr: ServerUserConfig['ssr'],
): boolean => {
  if (!ssr || typeof ssr !== 'object') {
    return false;
  }

  return ssr.moduleFederationAppSSR === true;
};

const isModuleFederationAppSSREnabled = (
  userConfig: AppToolsNormalizedConfig,
): boolean => {
  if (isModuleFederationAppSSREnabledInConfig(userConfig.server?.ssr)) {
    return true;
  }

  if (
    userConfig.server?.ssrByEntries &&
    typeof userConfig.server.ssrByEntries === 'object'
  ) {
    return Object.values(userConfig.server.ssrByEntries).some(
      isModuleFederationAppSSREnabledInConfig,
    );
  }

  return false;
};

const isModuleFederationRspackPlugin = (
  plugin: RsbuildRspackPluginLike,
): boolean => {
  const candidate = getRspackPluginName(plugin);

  return typeof candidate === 'string' && /modulefederation/i.test(candidate);
};

const hasModuleFederationMarker = (config: EnvironmentConfigLike): boolean => {
  if (process.env.MF_SSR_PRJ === 'true') {
    return true;
  }

  const define = config.source?.define || {};

  if ('REMOTE_IP_STRATEGY' in define || 'FEDERATION_IPV4' in define) {
    return true;
  }

  const plugins = getRspackPlugins(config.tools?.rspack);

  return plugins.some(isModuleFederationRspackPlugin);
};

const isNodeEnvironmentTarget = (target: unknown): boolean =>
  typeof target === 'string' &&
  (target === 'node' || target === 'async-node' || target.startsWith('node'));

export const shouldUseModuleFederationNodeOutput = (
  config: EnvironmentConfigLike,
): boolean =>
  isNodeEnvironmentTarget(config.output?.target) &&
  hasModuleFederationMarker(config);

const ssrIntegrationBuilderPlugin = (
  modernAPI: CLIPluginAPI<AppTools>,
): RsbuildPlugin => ({
  name: '@modern-js/ultramodern-builder-plugin-ssr',
  pre: ['@modern-js/builder-plugin-ssr'],
  setup(api) {
    api.modifyEnvironmentConfig((config, { name, mergeEnvironmentConfig }) => {
      const isServerEnvironment =
        isNodeEnvironmentTarget(config.output.target) || name === 'workerSSR';
      const userConfig = modernAPI.getNormalizedConfig();
      const hasServerRendering = hasServerRenderingConfig(userConfig);
      const hasModuleFederationRuntimeMarker =
        hasServerRendering && shouldUseModuleFederationNodeOutput(config);
      const hasExplicitMfSsrFlag = isModuleFederationAppSSREnabled(userConfig);
      const requireExplicitMfSsrFlag =
        process.env.MODERN_MF_APP_SSR_REQUIRE_EXPLICIT === 'true';

      if (
        hasServerRendering &&
        hasModuleFederationRuntimeMarker &&
        !hasExplicitMfSsrFlag
      ) {
        const warningMessage =
          '[modernjs][mf-ssr] Module Federation SSR was auto-detected from runtime markers. Set server.ssr.moduleFederationAppSSR=true explicitly in host and remotes to avoid heuristic drift.';
        if (requireExplicitMfSsrFlag) {
          throw new Error(
            `${warningMessage} (enforced by MODERN_MF_APP_SSR_REQUIRE_EXPLICIT=true)`,
          );
        }
        // eslint-disable-next-line no-console
        console.warn(warningMessage);
      }
      const isModuleFederationAppSSR =
        hasServerRendering && hasExplicitMfSsrFlag;
      return mergeEnvironmentConfig(config, {
        source: {
          define: {
            'process.env.MODERN_MF_APP_SSR': JSON.stringify(
              String(isModuleFederationAppSSR),
            ),
          },
        },
        ...(name === 'workerSSR' && userConfig.deploy?.target === 'cloudflare'
          ? { output: { module: true } }
          : {}),
        splitChunks:
          isServerEnvironment &&
          (hasModuleFederationRuntimeMarker || hasExplicitMfSsrFlag)
            ? false
            : undefined,
      });
    });
  },
});

/** Apply fork SSR policy after native SSR defaults through Rsbuild hooks. */
export const ultramodernSSRIntegrationPlugin = (): CliPlugin<AppTools> => ({
  name: '@modern-js/ultramodern-ssr-integration',
  setup(api) {
    api.config(() => ({ builderPlugins: [ssrIntegrationBuilderPlugin(api)] }));
  },
});
