import { resolveEffectOperationContracts } from './operation-contracts';

export async function generateEffectWorkerRuntimeWrapper(
  loader: { addDependency: (dependency: string) => void },
  options: { appDir: string; prefix: string; requestId?: string },
  resourcePath: string,
) {
  const operationContracts = await resolveEffectOperationContracts({
    appDir: options.appDir,
    resourcePath,
    prefix: options.prefix,
    requestId: options.requestId,
    onDependency: dependency => loader.addDependency(dependency),
  });
  const sourceRequest = `${resourcePath}?modern-bff-runtime-source`;
  return `import * as effectBffModule from ${JSON.stringify(sourceRequest)};
import { createEffectBffEdgeDispatcherFactory } from '@modern-js/bff-effect/effect-edge';
export const __modern_create_effect_bff_dispatcher = createEffectBffEdgeDispatcherFactory(effectBffModule, ${JSON.stringify(operationContracts ?? {})});
`;
}
