import type { ModernRoute } from '@modern-js/runtime/context';
import type { RouteObject } from '@modern-js/runtime-utils/router';
import type React from 'react';

export type { ModernRoute } from '@modern-js/runtime/context';
export type {
  InternalRouterServerSnapshot,
  RouterFramework,
} from '@modern-js/runtime-extensions/router-state';

/** TanStack-specific router config. */
export type RouterConfig = {
  routesConfig: {
    globalApp?: React.ComponentType<any>;
    routes?: ModernRoute[];
  };
  serverBase?: string[];
  supportHtml5History?: boolean;
  basename?: string;
  createRoutes?: () => RouteObject[];
  defaultStructuralSharing?: boolean;
  unstable_reloadOnURLMismatch?: boolean;
};

export const modernTanstackRouterFastDefaults = {
  defaultStructuralSharing: true,
} as const;

export const getModernTanstackRouterFastDefaults = (
  config: Partial<Pick<RouterConfig, 'defaultStructuralSharing'>> = {},
) => ({
  defaultStructuralSharing:
    config.defaultStructuralSharing ??
    modernTanstackRouterFastDefaults.defaultStructuralSharing,
});
