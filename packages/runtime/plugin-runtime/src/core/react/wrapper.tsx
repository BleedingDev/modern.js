import type React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import {
  getGlobalEnableRsc,
  getGlobalInternalRuntimeContext,
  getInitialContext,
  InternalRuntimeContext,
  RuntimeContext,
  type TInternalRuntimeContext,
  type TRuntimeContext,
} from '../context';
import { stripRuntimeContextExtensions } from '../context/extensions';
import { ensureHelmetContext } from '../context/helmetContext';

function createRscSafeRequestContext(
  ssrContext: TInternalRuntimeContext['ssrContext'],
): TInternalRuntimeContext['requestContext'] {
  const requestContext = getInitialContext().requestContext;
  Object.defineProperty(requestContext.response, 'setHeader', {
    enumerable: false,
  });
  Object.defineProperty(requestContext.response, 'status', {
    enumerable: false,
  });

  if (ssrContext === undefined) {
    return requestContext;
  }

  const { request, response } = ssrContext;

  return {
    request: {
      url: request.url,
      userAgent: request.userAgent,
      cookie: request.cookie,
      pathname: request.pathname,
      query: { ...request.query },
      params: { ...request.params },
      headers: { ...request.headers },
      host: request.host,
      referer: request.referer,
    },
    response: Object.assign(requestContext.response, {
      locals: response.locals ?? {},
    }),
  };
}

export function wrapRuntimeContextProvider(
  App: React.ReactElement,
  contextValue: TRuntimeContext,
) {
  const {
    isBrowser,
    initialData,
    routes,
    context,
    routeManifest,
    routerContext,
    unstable_getBlockNavState,
    ssrContext,
    _internalContext,
    _internalRouterBaseName,
    ...rest
  } = contextValue as TInternalRuntimeContext;

  let internalContextValue = contextValue as TInternalRuntimeContext;
  const helmetContext = ensureHelmetContext(internalContextValue);

  let runtimeContextValue: TRuntimeContext = {
    isBrowser,
    initialData,
    routes,
    context,
    ...rest,
  };
  // Rest patterns copy enumerable symbol-keyed properties too, so the
  // internal extension slot (router instance, helmet state, ...) would ride
  // into the public context — strip it from the public copy. Internal readers
  // keep using `internalContextValue`, which is the original object.
  stripRuntimeContextExtensions(runtimeContextValue);

  const isRsc = getGlobalEnableRsc() === true;
  const isServerRsc = isRsc && isBrowser === false;
  if (isServerRsc) {
    const rscSafeRequestContext = createRscSafeRequestContext(ssrContext);
    internalContextValue = {
      ...internalContextValue,
      context: rscSafeRequestContext,
      requestContext: rscSafeRequestContext,
    };
    delete internalContextValue.ssrContext;
    runtimeContextValue = {
      ...runtimeContextValue,
      context: rscSafeRequestContext,
      requestContext: rscSafeRequestContext,
    };
  }

  const projection = {
    internalContext: internalContextValue,
    publicContext: runtimeContextValue,
  };
  const values =
    getGlobalInternalRuntimeContext()?.hooks.transformRuntimeContext?.call(
      projection,
      { context: contextValue, isRsc },
    ) ?? projection;

  return (
    <InternalRuntimeContext.Provider value={values.internalContext}>
      <RuntimeContext.Provider value={values.publicContext}>
        {isServerRsc ? (
          App
        ) : (
          <HelmetProvider context={helmetContext}>{App}</HelmetProvider>
        )}
      </RuntimeContext.Provider>
    </InternalRuntimeContext.Provider>
  );
}
