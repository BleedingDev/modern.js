import { compile } from 'path-to-regexp';
import { stringify } from 'qs';
import { readHeader, writeHeader } from './headers';
import type {
  BFFRequestPayload,
  IOptions,
  RequestClient,
  RequestCreator,
  RequestCreatorOptions,
  RequestDispatchContext,
  RequestFetcher,
  RequestHeaders,
  RequestHooks,
  RequestStartContext,
  RequestTarget,
  Sender,
  UploadCreator,
} from './types';
import { getUploadPayload } from './utiles';

type HeaderMap = RequestHeaders;
type RequestUrlOptions = {
  configDomain: string | undefined;
  domain: string | undefined;
  path: string;
  port: number;
};
type UploadUrlOptions = {
  configDomain: string | undefined;
  domain: string | undefined;
  path: string;
};

type RequestFactoryEnvironment<F> = {
  target: RequestTarget;
  getFetch: () => F;
  originFetch: F;
  readIncomingHeaders: () => HeaderMap;
  createInputParamsBody: (args: any[]) => any;
  resolveRequestUrl: (options: RequestUrlOptions) => string;
  resolveUploadUrl: (options: UploadUrlOptions) => string;
};

export const extractPathParamNames = (path: string): string[] =>
  Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g)).flatMap(([, key]) =>
    key ? [key] : [],
  );

export const createRequestFactory = <F>(
  environment: RequestFactoryEnvironment<F>,
): RequestClient<F> => {
  const isServerTarget = environment.target === 'server';
  const realRequest: Map<string, F> = new Map();
  const realAllowedHeaders: Map<string, string[]> = new Map();
  const domainMap: Map<string, string> = new Map();

  const startRequest = (requestId: string, hooks?: RequestHooks) => {
    const context: RequestStartContext = {
      requestId,
      target: environment.target,
      incomingHeaders: environment.readIncomingHeaders(),
      configured: realRequest.has(requestId),
      configuredDomain: domainMap.get(requestId),
    };
    hooks?.onStart?.(context);
    return context;
  };

  const prepareHeaders = (
    headers: HeaderMap,
    context: RequestStartContext,
    hooks?: RequestHooks,
  ) => {
    const allowedHeaders = realAllowedHeaders.get(context.requestId) || [];
    const forwardedHeaders: HeaderMap = {};
    if (isServerTarget) {
      for (const key of allowedHeaders) {
        const value = readHeader(context.incomingHeaders, key);
        if (typeof value !== 'undefined') {
          writeHeader(forwardedHeaders, key, value);
        }
      }
    }
    hooks?.prepareHeaders?.({
      ...context,
      headers,
      forwardedHeaders,
      allowedHeaders,
    });
    if (isServerTarget) {
      for (const [header, value] of Object.entries(forwardedHeaders)) {
        writeHeader(headers, header, value);
      }
    }
    return headers;
  };

  const dispatch = (context: RequestDispatchContext, hooks?: RequestHooks) =>
    hooks?.dispatch
      ? hooks.dispatch(context)
      : context.fetcher(context.url, context.init);

  const configure = (options: IOptions<F>) => {
    const {
      request,
      interceptor,
      allowedHeaders,
      setDomain,
      requestId = 'default',
    } = options;
    let configuredRequest = request || environment.originFetch;
    if (interceptor && !request) {
      configuredRequest = interceptor(environment.getFetch());
    }
    const resolvedDomain = setDomain?.({
      target: environment.target,
      requestId,
    });
    realAllowedHeaders.delete(requestId);
    if (Array.isArray(allowedHeaders)) {
      realAllowedHeaders.set(requestId, allowedHeaders);
    }
    if (typeof resolvedDomain === 'string') {
      domainMap.set(requestId, resolvedDomain);
    }
    realRequest.set(requestId, configuredRequest);
  };

  const createRequest: RequestCreator<F> = ((
    ...args: Parameters<RequestCreator<F>>
  ) => {
    const options: RequestCreatorOptions<F> =
      typeof args[0] === 'object' && args[0] !== null
        ? args[0]
        : {
            path: args[0],
            method: args[1],
            port: args[2],
            httpMethodDecider: args[3],
            fetch: args[4],
            requestId: args[5],
            hooks: args[6],
          };
    const {
      path,
      method,
      port,
      httpMethodDecider = 'functionName',
      fetch = environment.originFetch,
      domain,
      requestId = 'default',
      hooks,
    } = options;
    const getFinalPath = compile(path, { encode: encodeURIComponent });
    const keyNames = extractPathParamNames(path);

    const send = (...senderArgs: any[]) => {
      const context = startRequest(requestId, hooks);
      const fetcher = realRequest.get(requestId) || fetch;

      let body;
      let headers: HeaderMap;
      let url: string;

      if (httpMethodDecider === 'inputParams') {
        const configDomain = domainMap.get(requestId);
        url = environment.resolveRequestUrl({
          configDomain,
          domain,
          port,
          path,
        });
        body = environment.createInputParamsBody(senderArgs);
        headers = {
          'Content-Type': 'application/json',
        };
        headers = prepareHeaders(headers, context, hooks);
      } else {
        const payload: BFFRequestPayload =
          typeof senderArgs[senderArgs.length - 1] === 'object'
            ? senderArgs[senderArgs.length - 1]
            : {};
        payload.params = payload.params || {};

        const requestParams = senderArgs[0];
        if (typeof requestParams === 'object' && requestParams.params) {
          const { params } = requestParams;
          keyNames.forEach(keyName => {
            payload.params![keyName] = params[keyName];
          });
        } else {
          keyNames.forEach((keyName, index) => {
            payload.params![keyName] = senderArgs[index];
          });
        }

        const plainPath = getFinalPath(payload.params);
        const finalPath = payload.query
          ? `${plainPath}?${stringify(payload.query)}`
          : plainPath;
        headers = payload.headers ? { ...payload.headers } : {};

        headers = prepareHeaders(headers, context, hooks);

        if (payload.data) {
          headers['Content-Type'] = 'application/json';
          body =
            typeof payload.data === 'object'
              ? JSON.stringify(payload.data)
              : payload.body;
        } else if (payload.body) {
          headers['Content-Type'] = 'text/plain';
          body = payload.body;
        } else if (payload.formData) {
          body = payload.formData;
        } else if (payload.formUrlencoded) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body =
            !isServerTarget &&
            typeof URLSearchParams !== 'undefined' &&
            payload.formUrlencoded instanceof URLSearchParams
              ? payload.formUrlencoded
              : typeof payload.formUrlencoded === 'object'
                ? stringify(payload.formUrlencoded)
                : payload.formUrlencoded;
        }

        const configDomain = domainMap.get(requestId);
        url = environment.resolveRequestUrl({
          configDomain,
          domain,
          port,
          path: finalPath,
        });
      }

      if (!isServerTarget) {
        writeHeader(headers, 'accept', `application/json,*/*;q=0.8`);
      }

      if (method.toLowerCase() === 'get') {
        body = undefined;
      }

      if (isServerTarget) {
        writeHeader(headers, 'accept', `application/json,*/*;q=0.8`);
      }

      return dispatch(
        {
          ...context,
          path,
          requestId,
          method,
          url,
          init: {
            method,
            body,
            headers,
          },
          fetcher: fetcher as RequestFetcher,
        },
        hooks,
      );
    };

    const sender: Sender<F> = isServerTarget
      ? send
      : async (...senderArgs: any[]) => send(...senderArgs);

    return sender;
  }) as RequestCreator<F>;

  const createUploader: UploadCreator = ({
    path,
    domain,
    requestId = 'default',
    hooks,
  }) => {
    const getUploadPath = isServerTarget
      ? undefined
      : compile(path, { encode: encodeURIComponent });

    const sender: Sender = (...args) => {
      const context = startRequest(requestId, hooks);
      const fetcher = realRequest.get(requestId) || environment.originFetch;
      const { body, headers: uploadHeaders, params } = getUploadPayload(args);
      let headers: HeaderMap = { ...uploadHeaders };
      const finalPath = getUploadPath ? getUploadPath(params) : path;

      const configDomain = domainMap.get(requestId);
      const finalURL = environment.resolveUploadUrl({
        configDomain,
        domain,
        path: finalPath,
      });
      headers = prepareHeaders(headers, context, hooks);

      return dispatch(
        {
          ...context,
          path,
          requestId,
          method: 'POST',
          url: finalURL,
          init: {
            method: 'POST',
            body,
            headers,
          },
          fetcher: fetcher as RequestFetcher,
        },
        hooks,
      );
    };

    return sender;
  };

  return {
    configure,
    createRequest,
    createUploader,
  };
};
