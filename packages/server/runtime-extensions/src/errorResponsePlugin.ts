import { createSafeJsonFailureResponse } from '@modern-js/runtime-extensions/safe-failure';
import type { ServerPlugin } from '@modern-js/server-core';

/** Serialize unhandled BFF failures using the fork's public error contract. */
export const injectErrorResponsePlugin = (): ServerPlugin => ({
  name: '@modern-js/safe-error-response',
  setup(api) {
    api.handleError(async (input, next) => {
      const prefix = api.getServerConfig().bff?.prefix || '/api';
      const prefixes = Array.isArray(prefix) ? prefix : [prefix];
      if (prefixes.some(value => input.context.req.path.startsWith(value))) {
        return {
          ...input,
          response: createSafeJsonFailureResponse(input.error),
        };
      }
      next?.(input);
      return input;
    });
  },
});
