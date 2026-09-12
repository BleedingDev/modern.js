import { isBrowser, RuntimeContext } from '@modern-js/runtime';
import {
  InternalRuntimeContext,
  type TInternalRuntimeContext,
  type TRuntimeContext,
} from '@modern-js/runtime/context';
import { getRouterRuntimeState } from '@modern-js/runtime-extensions/router-state';
import type React from 'react';
import { useCallback, useContext, useSyncExternalStore } from 'react';
import {
  I18nNavigationProvider,
  type I18nRouterAdapter,
  type I18nRouterLinkTarget,
  useNativeI18nRouterAdapter,
} from './routerAdapter';

/**
 * Fork-owned: the selected-router navigation adapter.
 *
 * `useNativeI18nRouterAdapter` only knows react-router's own hooks, so a bare
 * `appTools() + i18nPlugin()` app running the TanStack router would fall back
 * to plain `<a>` links and a non-reactive `window.location`. That breaks
 * language-invariant active state and, worse, leaves the i18n language stuck
 * after a client-side navigation to a localized URL.
 *
 * This adapter reads the actual selected router out of the fork-owned router
 * runtime-state slot, so it serves both routers without either plugin having
 * to know about i18n. It lives here (rather than in
 * `@modern-js/i18n-integration`) because that package peer-depends on
 * `@modern-js/runtime`; wiring it into the default runtime path would close an
 * Nx cycle. `@modern-js/runtime-extensions` carries no such edge, so nothing
 * new enters the graph. `@modern-js/i18n-integration` re-exports this module so
 * the composed `ultramodernI18nIntegrationPlugin` keeps its own entry point.
 */

type I18nRouterFramework = 'react-router' | 'tanstack' | string;

interface I18nRouterLocation {
  pathname: string;
  search: string;
  hash: string;
}

interface I18nRouterNavigateOptions {
  replace?: boolean;
  state?: unknown;
}

type I18nRouterNavigate = (
  href: string,
  options?: I18nRouterNavigateOptions,
) => void | Promise<void>;

type I18nRouterLink = React.ComponentType<{
  to: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}>;

type RuntimeContextWithRouter = TRuntimeContext & {
  router?: {
    useInRouterContext?: () => boolean;
    useRouter?: (options?: { warn?: boolean }) => unknown;
    useLocation?: () => unknown;
    useNavigate?: () => I18nRouterNavigate;
    useParams?: () => Record<string, string>;
    useHref?: () => unknown;
    Link?: I18nRouterLink;
  };
};

type InternalRuntimeContextWithRouter = TInternalRuntimeContext & {
  router?: RuntimeContextWithRouter['router'];
};

type RouterInstance = {
  navigate?: (...args: any[]) => unknown;
  state?: {
    location?: unknown;
    matches?: Array<{ params?: Record<string, string> }>;
  };
  stores?: {
    location?: {
      get?: () => unknown;
      subscribe?: (listener: () => void) => () => void;
    };
    matches?: {
      get?: () => Array<{ params?: Record<string, string> }>;
    };
  };
  subscribe?:
    | ((listener: () => void) => () => void)
    | ((eventType: string, listener: () => void) => () => void);
};

const normalizeUrlPart = (value: unknown, prefix: '?' | '#'): string => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
};

const normalizeLocation = (location: unknown): I18nRouterLocation | null => {
  if (!location || typeof location !== 'object') {
    return null;
  }

  const locationValue = location as {
    pathname?: unknown;
    search?: unknown;
    searchStr?: unknown;
    hash?: unknown;
  };

  if (typeof locationValue.pathname !== 'string') {
    return null;
  }

  return {
    pathname: locationValue.pathname,
    search: normalizeUrlPart(
      typeof locationValue.search === 'string'
        ? locationValue.search
        : locationValue.searchStr,
      '?',
    ),
    hash: normalizeUrlPart(locationValue.hash, '#'),
  };
};

const getWindowLocation = (): I18nRouterLocation | null => {
  if (!isBrowser()) {
    return null;
  }

  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
};

const getRouterFramework = (
  runtimeContext: RuntimeContextWithRouter,
  internalContext: InternalRuntimeContextWithRouter,
  inReactRouter: boolean,
): I18nRouterFramework | undefined => {
  const framework =
    getRouterRuntimeState(internalContext)?.framework ||
    getRouterRuntimeState(runtimeContext)?.framework;

  if (framework) {
    return framework;
  }

  if (internalContext.router?.useRouter || runtimeContext.router?.useRouter) {
    return 'tanstack';
  }

  if (
    internalContext.router?.useLocation ||
    internalContext.router?.useHref ||
    runtimeContext.router?.useLocation ||
    runtimeContext.router?.useHref
  ) {
    return 'react-router';
  }

  if (inReactRouter) {
    return 'react-router';
  }

  return undefined;
};

const getRouterInstance = (
  internalContext: InternalRuntimeContextWithRouter,
  contextRouter?: RouterInstance | null,
): RouterInstance | null => {
  if (contextRouter) {
    return contextRouter;
  }

  const router = getRouterRuntimeState(internalContext)?.instance;
  if (!router || typeof router !== 'object') {
    return null;
  }
  return router as RouterInstance;
};

const getRouterStateLocation = (
  internalContext: InternalRuntimeContextWithRouter,
  contextRouter?: RouterInstance | null,
): I18nRouterLocation | null => {
  const router = getRouterInstance(internalContext, contextRouter);
  return (
    normalizeLocation(router?.stores?.location?.get?.()) ||
    normalizeLocation(router?.state?.location)
  );
};

const getRouterParams = (
  internalContext: InternalRuntimeContextWithRouter,
  contextRouter?: RouterInstance | null,
): Record<string, string> => {
  const router = getRouterInstance(internalContext, contextRouter);
  const matches = router?.stores?.matches?.get?.() || router?.state?.matches;
  if (!Array.isArray(matches)) {
    return {};
  }

  return matches.reduce<Record<string, string>>((params, match) => {
    if (match?.params) {
      Object.assign(params, match.params);
    }
    return params;
  }, {});
};

const getRouterSnapshot = (
  internalContext: InternalRuntimeContextWithRouter,
  contextRouter?: RouterInstance | null,
) => {
  const location = getRouterStateLocation(internalContext, contextRouter);
  const params = getRouterParams(internalContext, contextRouter);
  return JSON.stringify([
    location?.pathname ?? '',
    location?.search ?? '',
    location?.hash ?? '',
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
  ]);
};

export const useIntegratedRouterAdapter = (): I18nRouterAdapter => {
  const runtimeContext = useContext(RuntimeContext) as RuntimeContextWithRouter;
  const internalContext = useContext(
    InternalRuntimeContext,
  ) as InternalRuntimeContextWithRouter;
  const routerApi = internalContext.router || runtimeContext.router;
  const native = useNativeI18nRouterAdapter();
  const inReactRouter = native.hasRouter;
  const reactRouterNavigate = native.navigate;
  const reactRouterLocation = inReactRouter ? native.location : null;
  const reactRouterParams = native.params;
  const framework = getRouterFramework(
    runtimeContext,
    internalContext,
    inReactRouter,
  );
  const contextUseRouter =
    !inReactRouter && framework === 'tanstack'
      ? internalContext.router?.useRouter || runtimeContext.router?.useRouter
      : undefined;
  const contextRouter = contextUseRouter
    ? (contextUseRouter({ warn: false }) as RouterInstance | null)
    : null;
  const hasRouter =
    framework === 'tanstack' ||
    framework === 'react-router' ||
    Boolean(reactRouterNavigate);

  const subscribeToRouter = useCallback(
    (update: () => void) => {
      const router = getRouterInstance(internalContext, contextRouter);
      if (!router) {
        return () => undefined;
      }

      const unsubscribers: Array<() => void> = [];

      if (
        framework === 'react-router' &&
        !inReactRouter &&
        typeof router.subscribe === 'function'
      ) {
        const subscribe = router.subscribe as (
          this: RouterInstance,
          listener: () => void,
        ) => () => void;
        const unsubscribe = subscribe.call(router, update);
        if (typeof unsubscribe === 'function') {
          unsubscribers.push(unsubscribe);
        }
      }

      if (
        framework === 'tanstack' &&
        typeof router.stores?.location?.subscribe === 'function'
      ) {
        const unsubscribe = router.stores.location.subscribe(update);
        if (typeof unsubscribe === 'function') {
          unsubscribers.push(unsubscribe);
        }
      }

      if (framework === 'tanstack' && typeof router.subscribe === 'function') {
        const subscribe = router.subscribe as (
          this: RouterInstance,
          eventType: string,
          listener: () => void,
        ) => () => void;
        for (const eventType of ['onBeforeNavigate', 'onBeforeLoad']) {
          const unsubscribe = subscribe.call(router, eventType, update);
          if (typeof unsubscribe === 'function') {
            unsubscribers.push(unsubscribe);
          }
        }
      }

      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      };
    },
    [contextRouter, framework, inReactRouter, internalContext],
  );
  const getSnapshot = useCallback(
    () => getRouterSnapshot(internalContext, contextRouter),
    [contextRouter, internalContext],
  );
  useSyncExternalStore(subscribeToRouter, getSnapshot, getSnapshot);

  const navigate = useCallback<I18nRouterNavigate>(
    (href, options) => {
      const router = getRouterInstance(internalContext, contextRouter);
      const activeFramework = getRouterFramework(
        runtimeContext,
        internalContext,
        inReactRouter,
      );

      if (activeFramework === 'tanstack') {
        if (typeof router?.navigate === 'function') {
          return router.navigate({
            to: href,
            replace: options?.replace,
            ...(options?.state === undefined ? {} : { state: options.state }),
          }) as void | Promise<void>;
        }
        throw new Error('TanStack router instance is not available.');
      }

      if (reactRouterNavigate) {
        return reactRouterNavigate(href, options);
      }

      if (activeFramework === 'react-router') {
        if (typeof router?.navigate === 'function') {
          return router.navigate(href, options) as void | Promise<void>;
        }
        throw new Error('React Router instance is not available.');
      }
    },
    [
      contextRouter,
      internalContext,
      inReactRouter,
      reactRouterNavigate,
      runtimeContext,
    ],
  );

  const location =
    (reactRouterLocation
      ? normalizeLocation(reactRouterLocation)
      : getRouterStateLocation(internalContext, contextRouter)) ||
    getWindowLocation();
  const params = inReactRouter
    ? (reactRouterParams as Record<string, string>)
    : getRouterParams(internalContext, contextRouter);
  const Link =
    framework === 'tanstack'
      ? internalContext.router?.Link || runtimeContext.router?.Link || null
      : framework === 'react-router' || inReactRouter
        ? (routerApi?.Link ?? null)
        : null;

  return {
    framework,
    hasRouter,
    location,
    navigate: hasRouter ? navigate : null,
    Link,
    params,
    ...(framework === 'tanstack'
      ? { createLinkProps: createTanstackLinkProps }
      : {}),
  };
};

const createTanstackLinkProps = (target: I18nRouterLinkTarget) => {
  const preload =
    target.preload !== undefined
      ? target.preload
      : target.prefetch === 'none'
        ? false
        : target.prefetch;
  return {
    to: target.pathname,
    ...(target.search ? { search: target.search } : {}),
    ...(target.hash ? { hash: target.hash } : {}),
    ...(target.hashScrollIntoView === undefined
      ? {}
      : { hashScrollIntoView: target.hashScrollIntoView }),
    ...(preload === undefined ? {} : { preload }),
  };
};

/** Supplies the actual selected router; native links still render its Link. */
export const I18nRouterNavigationProvider = ({
  children,
}: React.PropsWithChildren) => {
  const value = useIntegratedRouterAdapter();
  return (
    <I18nNavigationProvider value={value}>{children}</I18nNavigationProvider>
  );
};
