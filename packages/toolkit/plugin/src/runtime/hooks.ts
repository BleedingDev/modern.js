import {
  createAsyncInterruptHook,
  createCollectSyncHook,
  createSyncHook,
} from '../hooks';
import type {
  ConfigFn,
  ExtendStreamSSRFn,
  ExtendStringSSRCollectorsFn,
  Hooks,
  OnBeforeRenderFn,
  PickContextFn,
  ResolveComponentFn,
  StringSSRCollectorsInfo,
  TransformRuntimeContextFn,
  WrapRootFn,
} from '../types/runtime/hooks';

export function initHooks<RuntimeConfig, RuntimeContext>(): Hooks<
  RuntimeConfig,
  RuntimeContext
> {
  return {
    onBeforeRender:
      createAsyncInterruptHook<OnBeforeRenderFn<RuntimeContext>>(),
    wrapRoot: createSyncHook<WrapRootFn>(),
    resolveComponent: createSyncHook<ResolveComponentFn>(),
    pickContext: createSyncHook<PickContextFn<RuntimeContext>>(),
    transformRuntimeContext:
      createSyncHook<TransformRuntimeContextFn<RuntimeContext>>(),
    config: createCollectSyncHook<ConfigFn<RuntimeConfig>>(),
    extendStringSSRCollectors:
      createCollectSyncHook<
        ExtendStringSSRCollectorsFn<StringSSRCollectorsInfo<RuntimeContext>>
      >(),
    extendStreamSSR: createCollectSyncHook<ExtendStreamSSRFn<RuntimeContext>>(),
  };
}
