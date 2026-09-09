/**
 * The router runtime state helpers are owned by @modern-js/runtime-extensions (the same
 * implementation backs the built-in react-router provider and the SSR
 * pipeline). This module only re-exports them so every router provider
 * writes to the exact same runtime-context extension slot.
 */

export type { RouterLifecycleContext } from '@modern-js/runtime/context';
export {
  applyRouterRuntimeState,
  applyRouterServerPrepareResult,
  createRouterRuntimeState,
  createRouterServerSnapshot,
  getRouterRuntimeState,
  getRouterServerSnapshot,
  type RouterLifecyclePhase,
} from '@modern-js/runtime-extensions/router-state';
