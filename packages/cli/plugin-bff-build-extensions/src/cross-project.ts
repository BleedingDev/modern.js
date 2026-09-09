import '@modern-js/server-runtime-extensions/server-config';
import path from 'node:path';
import {
  type CrossProjectApiPluginOptions,
  createCrossProjectApiPlugin,
} from '@modern-js/plugin-bff/cross-project';
import type { OperationContractMap } from '@modern-js/server-runtime-extensions/bff-policy/node';

export interface CrossProjectBffDescriptor {
  native: Omit<CrossProjectApiPluginOptions, 'modifyResolvedConfig'>;
  runtimeFramework: 'hono' | 'effect';
  relativeEffectEntry: string;
  requestId: string;
  operationContracts: OperationContractMap;
}

export function createCrossProjectBffPlugin(
  descriptor: CrossProjectBffDescriptor,
) {
  return createCrossProjectApiPlugin({
    ...descriptor.native,
    modifyResolvedConfig: (resolvedConfig, { sdkDistDirectory, api }) => {
      const config = api.getConfig();
      const configuredRuntimeFramework = config?.bff?.runtimeFramework;
      if (
        configuredRuntimeFramework &&
        configuredRuntimeFramework !== descriptor.runtimeFramework
      ) {
        throw new Error(
          `[${descriptor.native.packageName}] Runtime framework mismatch for cross-project BFF. Detected "${configuredRuntimeFramework}", but producer SDK requires "${descriptor.runtimeFramework}".`,
        );
      }
      const effectEntry = descriptor.relativeEffectEntry
        ? path.join(sdkDistDirectory, descriptor.relativeEffectEntry)
        : undefined;
      api.updateAppContext({
        ...(effectEntry ? { apiDirectory: path.dirname(effectEntry) } : {}),
        bffRuntimeFramework: descriptor.runtimeFramework,
      });
      resolvedConfig.bff ??= {};
      resolvedConfig.bff.runtimeFramework = descriptor.runtimeFramework;
      if (effectEntry)
        resolvedConfig.bff.effect = {
          ...resolvedConfig.bff.effect,
          entry: effectEntry,
        };
      resolvedConfig.bff.requestId =
        resolvedConfig.bff.requestId ||
        config?.bff?.requestId ||
        descriptor.requestId ||
        descriptor.native.packageName ||
        'default';
      const policy = resolvedConfig.bff.crossProjectPolicy;
      resolvedConfig.bff.crossProjectPolicy = {
        ...policy,
        enabled: policy?.enabled ?? true,
        requireEnvelope: policy?.requireEnvelope ?? true,
        requireOperationContext: policy?.requireOperationContext ?? true,
        requireOperationContextDetails:
          policy?.requireOperationContextDetails ?? true,
        requireOperationSchemaHash: policy?.requireOperationSchemaHash ?? true,
        requireOperationVersion: policy?.requireOperationVersion ?? true,
        allowUnknownOperations: policy?.allowUnknownOperations ?? false,
        expectedOperationContracts: {
          ...policy?.expectedOperationContracts,
          ...descriptor.operationContracts,
        },
      };
      return resolvedConfig;
    },
  });
}
