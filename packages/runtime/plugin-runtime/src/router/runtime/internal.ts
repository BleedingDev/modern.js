export {
  type RouterExtendsHooks,
  type RouterLifecycleContext,
  routerProviderRegistryHooks,
} from './hooks';
export type { LinkPrefetchPolicy } from './PrefetchLink';
export { modifyRoutes, routerPlugin, routerPlugin as default } from './plugin';
export type { RouterConfig, SingleRouteConfig } from './types';
export { renderRoutes } from './utils';
