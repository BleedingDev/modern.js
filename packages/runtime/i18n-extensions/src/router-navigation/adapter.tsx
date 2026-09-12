import { isBrowser, RuntimeContext } from '@modern-js/runtime';
import {
  InternalRuntimeContext,
  type TInternalRuntimeContext,
  type TRuntimeContext,
} from '@modern-js/runtime/context';
import {
  getRouterRuntimeState,
  subscribeRouterRuntimeState,
} from '@modern-js/runtime-extensions/router-state';
import type React from 'react';
import { useCallback, useContext, useSyncExternalStore } from 'react';

/**
 * Fork-owned: the selected-router navigation adapter.
 *
 * `useNativeI18nRouterAdapter` only knows react-router's own hooks, so a bare
 * `appTools() + i18nPlugin()` app running the TanStack router would fall back
 * to plain `<a>` links and a non-reactive `window.location`. That breaks
 * language-invariant active state and, worse, leaves the i18n language stuck
 * after a client-side navigation to a localized URL.
 *
 * The subsystem lives in this fork-owned package rather than inside
 * upstream-owned `@modern-js/plugin-i18n`: that package only wires it in
 * through its existing `NavigationProvider` extension point, so the upstream
 * package keeps a seam instead of gaining a fork subsystem. The primitives the
 * adapter composes with - the navigation context provider, the native
 * react-router adapter and the adapter shape - are injected by that seam, so
 * nothing here imports `@modern-js/plugin-i18n` and no dependency cycle is
 * created.
 *
 * The adapter reads the actual selected router out of the fork-owned router
 * runtime-state slot, so it serves both routers without either plugin having
 * to know about i18n.
 */

/** The primitives the host plugin injects; see `createI18nRouterNavigation`. */
export interface I18nRouterNavigationDependencies<
  Adapter extends I18nRouterAdapterShape,
> {
  I18nNavigationProvider: React.ComponentType<
    React.PropsWithChildren<{ value: Adapter }>
  >;
  useNativeI18nRouterAdapter: () => Adapter;
}

export interface I18nRouterLinkTarget {
  pathname: string;
  href: string;
  search?: Record<string, unknown>;
  hash?: string;
  hashScrollIntoView?: boolean | ScrollIntoViewOptions;
  prefetch?: 'intent' | 'render' | 'viewport' | 'none';
  preload?: unknown;
}

export interface I18nRouterAdapterShape {
  framework?: string;
  hasRouter: boolean;
  location: { pathname: string; search: string; hash: string } | null;
  navigate:
    | ((
        href: string,
        options?: { replace?: boolean; state?: unknown },
      ) => void | Promise<void>)
    | null;
  Link: React.ComponentType<{
    to: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }> | null;
  params: Record<string, string>;
  createLinkProps?: (target: I18nRouterLinkTarget) => {
    to: string;
    [key: string]: unknown;
  };
}

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

/**
 * Build the selected-router navigation hook and provider from the host
 * plugin's own primitives. Injecting them is what keeps this fork-owned
 * subsystem free of any import edge back into the plugin that installs it.
 */
export const createI18nRouterNavigation = <
  Adapter extends I18nRouterAdapterShape,
>({
  I18nNavigationProvider,
  useNativeI18nRouterAdapter,
}: I18nRouterNavigationDependencies<Adapter>) => {
  const useIntegratedRouterAdapter = (): Adapter => {
    const runtimeContext = useContext(
      RuntimeContext,
    ) as RuntimeContextWithRouter;
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
    // `hasRouter` means "this adapter can actually drive a router", not "a
    // router framework was named". Two things can drive one: a live react-router
    // context we are rendering inside, or an instance published in the
    // runtime-state slot. A framework name alone is neither.
    //
    // This matters because router providers publish their name before their
    // instance. `plugin-tanstack` publishes its hooks in `onBeforeRender` and
    // only installs the instance when `RouterWrapper` renders - below anything
    // wrapping the app, this provider included - so on a CSR boot the first
    // evaluation here sees a name and no instance. Claiming a router there hands
    // `changeLanguage()` a `navigate` that can only throw, instead of letting it
    // fall back to a full-page load.
    const slotRouter = getRouterInstance(internalContext, contextRouter);
    // A slot instance counts only when `navigate` below can drive it: a named
    // framework this adapter implements, with a navigate function. An unknown
    // provider's instance would otherwise hand `changeLanguage()` a navigate
    // that goes nowhere instead of the routerless full-page fallback.
    const drivableSlotRouter =
      (framework === 'tanstack' || framework === 'react-router') &&
      typeof slotRouter?.navigate === 'function';
    const hasRouter = Boolean(reactRouterNavigate) || drivableSlotRouter;

    const subscribeToRouter = useCallback(
      (update: () => void) => {
        const unsubscribers: Array<() => void> = [];

        // The instance can arrive after this provider has already rendered, so
        // watch the slot itself: without this the store subscription below would
        // be a permanent no-op on a CSR boot and the adapter would never notice
        // the router it is meant to drive.
        const unsubscribeFromSlot = subscribeRouterRuntimeState(
          internalContext,
          update,
        );
        if (typeof unsubscribeFromSlot === 'function') {
          unsubscribers.push(unsubscribeFromSlot);
        }

        const router = getRouterInstance(internalContext, contextRouter);
        if (!router) {
          return () => {
            for (const unsubscribe of unsubscribers) {
              unsubscribe();
            }
          };
        }

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

        if (
          framework === 'tanstack' &&
          typeof router.subscribe === 'function'
        ) {
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
    } as Adapter;
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

  /**
   * Supplies the actual selected router; native links still render its Link.
   *
   * This provider sits above the app, so it sits above the router element too.
   * That is fine for a router this adapter reaches through the fork-owned
   * runtime-state slot - TanStack hands out its instance, not a React context -
   * but react-router publishes its location and navigate through context that
   * only exists *below* the router. Reading it from up here yields an inert
   * adapter, and publishing that would shadow the native one a consumer
   * resolves at its own position, where the context is live. So only take over
   * for the router reached through the slot, and only once its instance is
   * actually installed; until then `useI18nRouterAdapter` falls back to the
   * native adapter and `changeLanguage()` keeps its full-page behaviour.
   */
  const I18nRouterNavigationProvider = ({
    children,
  }: React.PropsWithChildren) => {
    const value = useIntegratedRouterAdapter();
    const native = useNativeI18nRouterAdapter();
    // Publish only what a consumer could not resolve better itself. Inside a
    // live react-router context the native adapter - evaluated at the
    // consumer's own position, where that context exists - is already the
    // right answer, and shadowing it with one read from above the router
    // yields an inert adapter. With no router to drive at all, staying absent
    // is what preserves the full-page `changeLanguage()` fallback.
    if (!value.hasRouter || native.hasRouter) {
      return <>{children}</>;
    }
    return (
      <I18nNavigationProvider value={value}>{children}</I18nNavigationProvider>
    );
  };

  return { useIntegratedRouterAdapter, I18nRouterNavigationProvider };
};
