import { createRequire } from 'node:module';
import path from 'node:path';
import { preserveNpmAliases, readPackageIdentity } from './npmAliases';
import {
  type DeployOutputConfig,
  resolveDeployTarget as defaultResolveDeployTarget,
} from './target';

export interface DeployOutputPluginApi {
  getAppContext(): { appDirectory: string; metaName: string };
  getNormalizedConfig(): DeployOutputConfig;
  onAfterDeploy(handler: () => Promise<void>): void;
}

export const createDeployOutputAliasesPlugin = ({
  resolveDeployTarget = defaultResolveDeployTarget,
}: {
  resolveDeployTarget?: (config: DeployOutputConfig) => string;
} = {}) => ({
  name: '@modern-js/deploy-output-aliases',
  setup(api: DeployOutputPluginApi) {
    api.onAfterDeploy(async () => {
      const { appDirectory, metaName } = api.getAppContext();
      const config = api.getNormalizedConfig();
      if (
        (metaName !== 'modern-js' &&
          !config.deploy?.target &&
          !process.env.MODERNJS_DEPLOY) ||
        resolveDeployTarget(config) !== 'node'
      ) {
        return;
      }

      const entry = createRequire(__filename).resolve('@modern-js/prod-server');
      const identity = await readPackageIdentity(entry);
      await preserveNpmAliases({
        appDirectory,
        outputDirectory: path.join(appDirectory, '.output'),
        implicitAliases: [
          {
            aliasName: '@modern-js/prod-server',
            targetName: identity.name,
            targetVersion: identity.version,
          },
        ],
      });
    });
  },
});
