import type {
  AppTools,
  BffClientArtifacts,
  BffGeneration,
} from '@modern-js/app-tools';
import { ApiRouter } from '@modern-js/bff-core';
import type { CLIPluginAPI } from '@modern-js/plugin';
import type { GeneratedEffectClientArtifacts } from '@modern-js/plugin-bff-extensions/client-generator';
import {
  buildOperationContractMap,
  deriveOperationVersion,
  type OperationContractMap,
} from '@modern-js/server-runtime-extensions/bff-policy/node';
import { fs, upath as path } from '@modern-js/utils';

export const BFF_REQUEST_RUNTIME =
  '@modern-js/runtime-extensions/request-policy';

export interface BffGenerationMetadata {
  runtimeFramework: 'effect' | 'hono';
  relativeEffectEntry: string;
  operationContracts: OperationContractMap;
  effectArtifacts?: GeneratedEffectClientArtifacts;
}

export function registerBffClientArtifacts(
  api: CLIPluginAPI<AppTools>,
  metadata: WeakMap<BffGeneration, BffGenerationMetadata>,
) {
  api.modifyBffClientArtifacts(async (context: BffClientArtifacts) => {
    const { generation } = context;
    const config = api.getNormalizedConfig();
    if (api.getAppContext().bffRuntimeFramework === 'effect') {
      const { generateEffectClient, resolveEffectEntryPaths } = await import(
        '@modern-js/plugin-bff-extensions/client-generator'
      );
      const { sourceEffectEntry, relativeEffectEntry } =
        resolveEffectEntryPaths({
          appDir: generation.appDirectory,
          apiDir: generation.apiDirectory,
          effectEntry: config.bff?.effect?.entry,
        });
      if (!sourceEffectEntry)
        throw new Error(
          `Cannot resolve Effect BFF entry in ${generation.apiDirectory}.`,
        );
      const artifacts = await generateEffectClient({
        appDir: generation.appDirectory,
        apiDir: generation.apiDirectory,
        resourcePath: sourceEffectEntry,
        prefix: generation.prefix,
        port: Number(generation.port),
        target: 'bundle',
        requestId: generation.requestId,
        requestCreator: generation.requestCreator || BFF_REQUEST_RUNTIME,
        httpMethodDecider: generation.httpMethodDecider,
        dataPlatformBatch: config.bff?.effect?.dataPlatform?.batch,
      });
      if (!artifacts)
        throw new Error(
          `Effect cross-project client generation failed for ${sourceEffectEntry}.`,
        );
      context.additionalArtifacts.push({
        sourcePath: path.relative(generation.apiDirectory, sourceEffectEntry),
        code: artifacts.code,
        declaration: artifacts.declaration,
      });
      metadata.set(generation, {
        runtimeFramework: 'effect',
        relativeEffectEntry,
        operationContracts: artifacts.operationContracts,
        effectArtifacts: artifacts,
      });
    } else {
      const router = new ApiRouter({
        appDir: generation.appDirectory,
        apiDir: generation.apiDirectory,
        lambdaDir: generation.lambdaDirectory,
        prefix: generation.prefix,
        httpMethodDecider: generation.httpMethodDecider,
        isBuild: true,
      });
      const packageJson = await fs.readJSON(
        path.join(generation.appDirectory, 'package.json'),
      );
      const operationContracts = generation.existLambda
        ? buildOperationContractMap({
            handlers: await router.getApiHandlers(),
            requestId: generation.requestId,
            operationVersion: deriveOperationVersion(packageJson.version),
          })
        : {};
      metadata.set(generation, {
        runtimeFramework: 'hono',
        relativeEffectEntry: '',
        operationContracts,
      });
    }
    return context;
  });
}
