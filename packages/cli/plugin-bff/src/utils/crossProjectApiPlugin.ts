import type {
  AppTools,
  AppToolsNormalizedConfig,
  CliPlugin,
} from '@modern-js/app-tools';
import type { CLIPluginAPI } from '@modern-js/plugin';
import path from 'path';

export interface CrossProjectApiPluginOptions {
  packageName: string;
  prefix: string;
  relativeDistPath: string;
  relativeApiPath: string;
  relativeLambdaPath: string;
  modifyResolvedConfig?: (
    config: AppToolsNormalizedConfig,
    context: {
      sdkDirectory: string;
      sdkDistDirectory: string;
      apiDirectory: string;
      lambdaDirectory: string;
      api: CLIPluginAPI<AppTools>;
    },
  ) => AppToolsNormalizedConfig | Promise<AppToolsNormalizedConfig>;
}

export const createCrossProjectApiPlugin = (
  options: CrossProjectApiPluginOptions,
): CliPlugin<AppTools> => ({
  name: '@modern-js/plugin-independent-bff',
  post: ['@modern-js/plugin-bff'],
  setup: api => {
    api.modifyResolvedConfig(async resolvedConfig => {
      const { appDirectory } = api.getAppContext();
      const sdkDirectory = path.join(
        appDirectory,
        'node_modules',
        options.packageName,
      );
      const sdkDistDirectory = path.join(
        sdkDirectory,
        options.relativeDistPath,
      );
      const apiDirectory = path.join(sdkDistDirectory, options.relativeApiPath);
      const lambdaDirectory = path.resolve(
        sdkDistDirectory,
        options.relativeLambdaPath,
      );
      const configuredPrefix = api.getConfig()?.bff?.prefix;
      if (configuredPrefix) {
        const isSamePrefix = Array.isArray(configuredPrefix)
          ? configuredPrefix.length === 1 &&
            configuredPrefix[0] === options.prefix
          : configuredPrefix === options.prefix;
        if (!isSamePrefix)
          throw new Error(
            `[${options.packageName}] Invalid bff.prefix for cross-project BFF. Detected "${configuredPrefix}", expected "${options.prefix}". Remove bff.prefix from the consumer app, or set it exactly to "${options.prefix}".`,
          );
      }
      api.updateAppContext({ apiDirectory, lambdaDirectory });
      resolvedConfig.bff ??= {};
      resolvedConfig.bff.prefix = options.prefix;
      resolvedConfig.bff.isCrossProjectServer = true;
      return options.modifyResolvedConfig
        ? options.modifyResolvedConfig(resolvedConfig, {
            sdkDirectory,
            sdkDistDirectory,
            apiDirectory,
            lambdaDirectory,
            api,
          })
        : resolvedConfig;
    });
  },
});

export default createCrossProjectApiPlugin;
