import type { ServerPluginAPI } from '@modern-js/server-core';
import type { OperationContractSource } from '@modern-js/server-runtime-extensions/bff-policy/node';
import { logger } from '@modern-js/utils';
import { resolveAdapterCrossProjectPolicy } from '../cross-project-policy/node';
import {
  type BindHonoRouteHandlersOptions,
  bindHonoRouteHandlers,
} from './bind-route-handlers';

export const createHonoRouteBinder = (
  api: ServerPluginAPI,
  handlers: OperationContractSource[],
) => {
  const policy = resolveAdapterCrossProjectPolicy(api, handlers);
  return (
    options: Pick<BindHonoRouteHandlersOptions, 'handler' | 'routePath'>,
  ) =>
    bindHonoRouteHandlers({
      ...options,
      policy,
      onError: api.getServerConfig()?.onError,
      reportError: error => logger.error(error),
    });
};
