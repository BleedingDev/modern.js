import { createRouterPrefetchPolicy } from './routerPrefetchPolicy';
import {
  applyRouterRuntimeState,
  createRouterServerSnapshot,
} from './routerState';

type ReactRouterServerContext = {
  statusCode: number;
  errors?: Record<string, unknown> | null;
  loaderData: Record<string, unknown>;
  matches: { route: { id?: string } }[];
};

type RouterLifecycleEvent = {
  framework: string;
  phase: string;
  runtimeContext: object;
  basename?: string;
  router?: unknown;
};

/** Install fork policy through lifecycle hooks supplied by the native owner. */
export function createRouterStatePlugin<Hooks extends Record<string, unknown>>({
  registryHooks,
}: {
  registryHooks: Hooks;
}) {
  return {
    name: '@modern-js/router-runtime-policy',
    registryHooks,
    setup(api: {
      onBeforeRender: (callback: (context: object) => void) => unknown;
      onAfterCreateRouter: (
        callback: (event: RouterLifecycleEvent) => void,
      ) => unknown;
    }) {
      api.onBeforeRender(context => {
        const runtimeContext = context as {
          linkPrefetchPolicy?: ReturnType<typeof createRouterPrefetchPolicy>;
        };
        runtimeContext.linkPrefetchPolicy ??= createRouterPrefetchPolicy();
      });
      api.onAfterCreateRouter(event => {
        if (event.framework !== 'react-router') {
          return;
        }
        if (event.phase === 'ssr-prepare') {
          const { routerContext } = event.runtimeContext as {
            routerContext?: ReactRouterServerContext;
          };
          if (!routerContext) {
            return;
          }
          const serverSnapshot = createRouterServerSnapshot({
            framework: event.framework,
            basename: event.basename,
            statusCode: routerContext.statusCode,
            errors: routerContext.errors ?? undefined,
            routerData: {
              loaderData: routerContext.loaderData,
              errors: routerContext.errors ?? undefined,
            },
            matches: routerContext.matches.flatMap(match =>
              typeof match.route.id === 'string'
                ? [{ routeId: match.route.id }]
                : [],
            ),
          });
          applyRouterRuntimeState(event.runtimeContext, {
            framework: event.framework,
            basename: event.basename,
            instance: event.router,
            matchedRouteIds: serverSnapshot.matchedRouteIds,
            serverSnapshot,
          });
        } else if (event.phase === 'client-create') {
          applyRouterRuntimeState(event.runtimeContext, {
            framework: event.framework,
            basename: event.basename,
            instance: event.router,
          });
        }
      });
    },
  };
}
