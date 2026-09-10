import {
  createEffectBffEdgeDispatcher,
  type EffectBffEdgeHandlerOptions,
} from './edge-dispatcher';

type OperationContracts = NonNullable<
  EffectBffEdgeHandlerOptions['crossProjectPolicy']
>['expectedOperationContracts'];

export function createEffectBffEdgeDispatcherFactory(
  module: EffectBffEdgeHandlerOptions['module'],
  generatedOperationContracts: OperationContracts,
) {
  return (options?: Omit<EffectBffEdgeHandlerOptions, 'module'>) => {
    const policy = options?.crossProjectPolicy;
    const crossProjectPolicy =
      policy === undefined ||
      policy === null ||
      policy.expectedOperationContracts === null ||
      typeof policy.expectedOperationContracts !== 'object' ||
      Array.isArray(policy.expectedOperationContracts)
        ? policy
        : {
            ...policy,
            expectedOperationContracts: {
              ...policy.expectedOperationContracts,
              ...generatedOperationContracts,
            },
          };
    return createEffectBffEdgeDispatcher({
      ...options,
      crossProjectPolicy,
      module,
    });
  };
}
