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
    pickContext: createSyncHook<PickContextFn<RuntimeContext>>(),
    transformRuntimeContext:
      createSyncHook<TransformRuntimeContextFn<RuntimeContext>>(),
    config: createCollectSyncHook<ConfigFn<RuntimeConfig>>(),
    extendStringSSRCollectors:
      createCollectSyncHook<
        ExtendStringSSRCollectorsFn<StringSSRCollectorsInfo>
      >(),
    extendStreamSSR: createCollectSyncHook<ExtendStreamSSRFn>(),
  };
}
