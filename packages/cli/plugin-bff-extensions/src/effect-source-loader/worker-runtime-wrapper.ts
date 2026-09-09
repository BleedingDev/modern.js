// @effect-diagnostics asyncFunction:off strictBooleanExpressions:off
import type { HttpMethodDecider } from '@modern-js/types';
import type { EffectClientCodegenOptions } from '../client-generator/types';

type EffectWorkerRuntimeGenerationOptions = {
  apiDir: string;
  appDir: string;
  effectDataPlatformBatch?: {
    allowedMethods?: string[];
    enabled?: boolean;
    endpoint?: string;
    flushIntervalMs?: number;
    maxBatchBytes?: number;
    maxBatchSize?: number;
    requestTimeoutMs?: number;
  };
  httpMethodDecider?: HttpMethodDecider;
  port: number;
  prefix: string;
  requestCreator?: string;
  requestId?: string;
};

export async function generateEffectWorkerRuntimeWrapper(
  loader: { addDependency: (dependency: string) => void },
  options: EffectWorkerRuntimeGenerationOptions,
  resourcePath: string,
) {
  const { generateEffectClient } = await import(
    '../client-generator/generator'
  );
  const artifacts = await generateEffectClient({
    appDir: options.appDir,
    apiDir: options.apiDir,
    resourcePath,
    prefix: options.prefix,
    port: Number(options.port),
    target: 'bundle',
    requestId: options.requestId,
    requestCreator: options.requestCreator,
    httpMethodDecider: options.httpMethodDecider,
    dataPlatformBatch: options.effectDataPlatformBatch,
    onDependency: dependency => loader.addDependency(dependency),
  });
  const sourceRequest = `${resourcePath}?modern-bff-runtime-source`;
  const operationContracts = artifacts?.operationContracts ?? {};

  return `import * as effectBffModule from ${JSON.stringify(sourceRequest)};
import { createEffectBffEdgeDispatcherFactory } from '@modern-js/bff-effect/effect-edge';
export const __modern_create_effect_bff_dispatcher = createEffectBffEdgeDispatcherFactory(effectBffModule, ${JSON.stringify(operationContracts)});
`;
}

export async function generateEffectClientCode(
  options: EffectClientCodegenOptions,
) {
  const { generateEffectClient } = await import(
    '../client-generator/generator'
  );
  const artifacts = await generateEffectClient(options);
  return artifacts === null ? null : artifacts.code;
}
