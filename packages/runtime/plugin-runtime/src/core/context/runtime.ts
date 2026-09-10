import type { ResolveComponentFn } from '@modern-js/plugin/runtime';
import type {
  RouteObject,
  StaticHandlerContext,
} from '@modern-js/runtime-utils/router';
import type { BaseSSRServerContext } from '@modern-js/types';
import { createContext, useContext } from 'react';
import type { LinkPrefetchPolicy } from '../../router/runtime/PrefetchLink';
import type { RouteManifest } from '../../router/runtime/types';
import type { RequestContext } from '../types';

export type { RequestContext };

const ROUTE_MANIFEST = '_MODERNJS_ROUTE_MANIFEST';

export type InternalSSRContext = {
  request: BaseSSRServerContext['request'] & { raw?: Request };
  response: BaseSSRServerContext['response'];
  [key: string]: any;
};

export interface TRuntimeContext {
  initialData?: Record<string, unknown>;
  isBrowser: boolean;
  routes?: RouteObject[];
  requestContext: RequestContext;
  /**
   * @deprecated Use `requestContext` instead
   */
  context: RequestContext;
  [key: string]: unknown;
}

// Runtime subpaths can be bundled independently. Share Context identities in
// the realm; React providers, not this registry, own their request values.
function getRuntimeReactContext<T>(
  kind: 'public' | 'internal' | 'component-resolver',
  create: () => T,
): T {
  const key = Symbol.for(`@modern-js/runtime:react-context:v1:${kind}`);
  const contexts = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  contexts[key] ??= create();
  return contexts[key] as T;
}

/**
 * InternalRuntimeContext used internally and by plugins
 */
export interface TInternalRuntimeContext extends TRuntimeContext {
  routeManifest?: RouteManifest;
  linkPrefetchPolicy?: LinkPrefetchPolicy;
  routes?: RouteObject[];
  routerContext?: StaticHandlerContext;
  unstable_getBlockNavState?: () => boolean;
  ssrContext?: InternalSSRContext;
  _internalContext?: any;
  _internalRouterBaseName?: any;
}

export const InternalRuntimeContext = getRuntimeReactContext('internal', () =>
  createContext<TInternalRuntimeContext>({} as TInternalRuntimeContext),
);

export const RuntimeContext = getRuntimeReactContext('public', () =>
  createContext<TRuntimeContext>({} as any),
);

export const RuntimeComponentResolverContext = getRuntimeReactContext(
  'component-resolver',
  () => createContext<ResolveComponentFn | undefined>(undefined),
);

/**
 * deprecated, use RuntimeContext instead
 */
export const ReactRuntimeContext = RuntimeContext;

/**
 * @deprecated use use(RuntimeContext) instead
 */
export const useRuntimeContext = (): TRuntimeContext =>
  useContext(RuntimeContext);

export const getInitialContext = (
  isBrowser = true,
  routeManifest?: RouteManifest,
): TInternalRuntimeContext => {
  const requestContext = {
    request: {
      params: {},
      pathname: '',
      query: {},
      headers: {},
      host: '',
      url: '',
    },
    response: {
      setHeader() {},
      status() {},
      locals: {},
    },
  };
  return {
    isBrowser,
    routeManifest:
      routeManifest ||
      (typeof window !== 'undefined' && (window as any)[ROUTE_MANIFEST]),
    requestContext,
    context: requestContext, // deprecated, keep for backward compatibility
  };
};
