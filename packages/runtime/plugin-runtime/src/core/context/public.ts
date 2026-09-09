import { getRuntimeReactContext } from '@modern-js/runtime-extensions/react-context';
import type { RouteObject } from '@modern-js/runtime-utils/router';
import { createContext, useContext } from 'react';
import type { RequestContext } from '../types';

export type { RequestContext };

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

export const RuntimeContext = getRuntimeReactContext('public', () =>
  createContext<TRuntimeContext>({} as any),
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
