import { stripRuntimeContextExtensions } from './contextExtensions';

// Only the transport fields consumed by this projection are required. This
// policy module does not depend on the native runtime or plugin API types.
interface ProjectionContext {
  isBrowser?: boolean;
  ssrContext?: {
    request: {
      url?: unknown;
      userAgent?: unknown;
      cookie?: unknown;
      pathname?: unknown;
      query?: object;
      params?: object;
      headers?: object;
      host?: unknown;
      referer?: unknown;
    };
    response: { locals?: unknown };
  };
}

function createRscSafeRequestContext(
  ssrContext: ProjectionContext['ssrContext'],
) {
  const requestContext = {
    request: {
      params: {},
      pathname: '',
      query: {},
      headers: {},
      host: '',
      url: '',
    },
    response: {
      setHeader() {},
      status() {},
      locals: {} as unknown,
    },
  };
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

export function projectRuntimeContext<
  InternalContext extends ProjectionContext,
  PublicContext extends ProjectionContext,
>(
  projection: {
    internalContext: InternalContext;
    publicContext: PublicContext;
  },
  options: { context: InternalContext; isRsc: boolean },
) {
  let internalContext = projection.internalContext;
  let publicContext = { ...projection.publicContext };
  // Enumerable symbol slots deliberately survive internal SSR copies. Remove
  // them only from the public projection, never from the original request.
  stripRuntimeContextExtensions(publicContext);

  if (options.isRsc && options.context.isBrowser === false) {
    const requestContext = createRscSafeRequestContext(
      options.context.ssrContext,
    );
    internalContext = {
      ...internalContext,
      context: requestContext,
      requestContext,
    };
    delete internalContext.ssrContext;
    publicContext = {
      ...publicContext,
      context: requestContext,
      requestContext,
    };
  }

  return { internalContext, publicContext };
}
