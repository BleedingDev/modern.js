import type { RouterFramework } from '@modern-js/runtime-extensions/router-state';
import type {
  Params,
  RouteObject,
  RouteProps,
} from '@modern-js/runtime-utils/router';

export type {
  BuiltInRouterFramework,
  InternalRouterRuntimeState,
  InternalRouterServerSnapshot,
  RouterFramework,
  RouterRouteMatchSnapshot,
  RouterServerPrepareResult,
} from '@modern-js/runtime-extensions/router-state';

export type ModernRoute = {
  type: 'nested' | 'page';
  path?: string;
  id?: string;
  component?: React.ComponentType | string;
  children?: ModernRoute[];
  [key: string]: any;
};

export type SingleRouteConfig = RouteProps & {
  redirect?: string;
  routes?: SingleRouteConfig[];
  key?: string;

  /**
   * layout component
   */
  layout?: React.ComponentType;

  /**
   * component would be rendered when route macthed.
   */
  component?: React.ComponentType;
};

export type RouterConfig = {
  /**
   * Select the router implementation used by Modern.js conventional routing.
   * - `react-router` (default): React Router based integration
   * - `tanstack`: TanStack Router integration
   */
  framework?: RouterFramework;
  routesConfig: {
    globalApp?: React.ComponentType<any>;
    routes?: ModernRoute[];
  };
  /**
   * You should not use it
   */
  oldVersion?: boolean;
  serverBase?: string[];
  supportHtml5History?: boolean;
  basename?: string;
  createRoutes?: () => RouteObject[];
  future?: Partial<{
    v7_startTransition: boolean;
  }>;
  /**
   * An unstable feature, which will reload the page when the current browser URL and the SSR Context URL do not match.
   */
  unstable_reloadOnURLMismatch?: boolean;
};

export type Routes = RouterConfig['routesConfig']['routes'];

export interface RouteManifest {
  routeAssets: RouteAssets;
}

export interface RouteAssets {
  [routeId: string]: {
    chunkIds?: (string | number)[];
    assets?: string[];
    referenceCssAssets?: string[];
  };
}

export interface LazyComponentDescriptor {
  _init: unknown;
  _payload: unknown;
}

export type ModernRouteObject = RouteObject & {
  isClientComponent?: boolean;
  hasClientLoader?: boolean;
  hasLoader?: boolean;
  hasAction?: boolean;
  inValidSSRRoute?: boolean;
  parentId?: string;
  lazyImport?: () => Promise<{ default: React.ComponentType }>;
  component?: React.ComponentType | LazyComponentDescriptor;
  entryCssFiles?: string[];
};

type LoaderContextKey<T = unknown> = {
  symbol: symbol;
  getDefaultValue: () => T;
};

interface LoaderRequestGet<P extends Record<string, unknown>> {
  <Key extends keyof P>(key: Key): P[Key];
  <T>(key: LoaderContextKey<T>): T;
}

interface LoaderRequestSet<P extends Record<string, unknown>> {
  <Key extends keyof P>(key: Key, value: P[Key]): void;
  <T>(key: LoaderContextKey<T>, value: T): void;
}

type LoaderRequestContext<P extends Record<string, unknown> = {}> = {
  get: LoaderRequestGet<P & Record<string, unknown>>;
  set: LoaderRequestSet<P & Record<string, unknown>>;
};

// fork from react-router due to the context being any in react-router.
interface DataFunctionArgs<D = any> {
  request: Request;
  params: Params;
  context?: D;
}

export type LoaderFunctionArgs<
  P extends Record<string, unknown> = Record<string, unknown>,
> = DataFunctionArgs<LoaderRequestContext<P>>;

declare type DataFunctionValue = Response | NonNullable<unknown> | null;

export type LoaderFunction = <
  P extends Record<string, unknown> = Record<string, unknown>,
>(
  args: LoaderFunctionArgs<P>,
) => Promise<DataFunctionValue> | DataFunctionValue;
