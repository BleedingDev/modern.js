import { setLoaderRouteIdResolver } from '@modern-js/plugin-data-loader/runtime';
import { resolveLocalisedLoaderRouteId } from '@modern-js/runtime-extensions/localised-loader-identity';
import {
  getLoaderCtx,
  type MiddlewareHandler,
  type ServerPlugin,
} from '@modern-js/server-core';

export function injectLocalisedLoaderPlugin(): ServerPlugin {
  return {
    name: '@modern-js/localised-loader',
    setup(api) {
      const handler: MiddlewareHandler = async (context, next) => {
        setLoaderRouteIdResolver(
          getLoaderCtx(context),
          (requestedRouteId, { routes, matchedRouteIds }) =>
            resolveLocalisedLoaderRouteId(
              routes,
              requestedRouteId,
              matchedRouteIds,
            ),
        );
        await next();
      };
      api.onPrepare(() => {
        api.getServerContext().middlewares.push({
          name: 'localised-loader-route-id',
          before: ['render'],
          handler,
        });
      });
    },
  };
}
