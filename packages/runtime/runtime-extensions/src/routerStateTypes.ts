export type BuiltInRouterFramework = 'react-router' | 'tanstack';

export type RouterFramework = BuiltInRouterFramework | (string & {});

export interface RouterRouteMatchSnapshot {
  routeId: string;
  assetRouteId?: string;
  pathname?: string;
  params?: Record<string, string>;
}

export interface InternalRouterServerSnapshot {
  framework?: RouterFramework;
  basename?: string;
  statusCode?: number;
  errors?: Record<string, unknown>;
  routerData?: {
    loaderData?: Record<string, unknown>;
    errors?: Record<string, unknown>;
  };
  hydrationScript?: string;
  hydrationScripts?: string[];
  matchedRouteIds?: string[];
  matches?: RouterRouteMatchSnapshot[];
}

export interface InternalRouterRuntimeState {
  framework: RouterFramework;
  basename?: string;
  instance?: unknown;
  hydrationScript?: string;
  hydrationScripts?: string[];
  matchedRouteIds?: string[];
  matches?: RouterRouteMatchSnapshot[];
  serverSnapshot?: InternalRouterServerSnapshot;
  cleanup?: () => void | Promise<void>;
}

export interface RouterServerPrepareResult {
  state: InternalRouterRuntimeState;
  snapshot?: InternalRouterServerSnapshot;
  redirect?: Response;
  cleanup?: () => void | Promise<void>;
}

export type RouterLifecyclePhase = 'ssr-prepare' | 'client-create' | 'hydrate';
