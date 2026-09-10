import type {
  RequestClient,
  RequestHeadersContext,
  RequestHooks,
} from '@modern-js/create-request/client';
import {
  attachOperationContextHeaders,
  buildEnvelopeHeaderValue,
  deleteHeader,
  firstHeaderValue,
  IdentityBindingViolationError,
  isEmptyDomain,
  isSecuredRequestId,
  ProducerDomainNotConfiguredError,
  parseTraceparentValue,
  readHeader,
  resolveConfiguredRequest,
  TRACEPARENT_HEADER,
  toOrigin,
  writeHeader,
} from './policyCore';
import { executeWithResilience } from './transport';
import type {
  AllowCrossOriginEnvelope,
  IdentityBindingOptions,
  IdentityBindingViolation,
  IOptions,
  OperationContractOptions,
  RequestCreator,
  RequestCreatorOptions,
  ResolveHeaders,
  TransportResilienceOptions,
  TransportTarget,
  UploadCreator,
} from './types';
import {
  BFF_DEFAULT_PROTECTED_IDENTITY_HEADERS,
  BFF_ENVELOPE_HEADER as ENVELOPE_HEADER,
  BFF_OPERATION_CONTEXT_DETAIL_HEADER as OPERATION_CONTEXT_DETAIL_HEADER,
  BFF_OPERATION_CONTEXT_HEADER as OPERATION_CONTEXT_HEADER,
} from './types';

type HeaderMap = Record<string, any>;
type PolicyEnvironment = {
  target: TransportTarget;
  resolveSourceOrigin: (incomingHeaders: HeaderMap) => string | undefined;
};

/** Bind fork producer policy to one isolated native request client. */
export const createPolicyClient = <F>(
  nativeClient: RequestClient<F>,
  environment: PolicyEnvironment,
) => {
  const isServerTarget = environment.target === 'server';
  const configuredRequests = new Map<string, boolean>();
  const realResolveHeaders: Map<string, ResolveHeaders> = new Map();
  const realRequireEnvelope: Map<string, boolean> = new Map();
  const realAllowCrossOriginEnvelope: Map<string, AllowCrossOriginEnvelope> =
    new Map();
  const realTransportResilience: Map<string, TransportResilienceOptions> =
    new Map();
  const realIdentityBinding: Map<string, IdentityBindingOptions> = new Map();
  const realOperationContract: Map<string, OperationContractOptions> =
    new Map();
  const domainMap: Map<string, string> = new Map();

  const attachEnvelopeHeaderIfRequired = (
    headers: HeaderMap,
    requestId: string,
    url: string,
    incomingHeaders: HeaderMap,
  ) => {
    const shouldRequireEnvelope =
      realRequireEnvelope.get(requestId) ?? isSecuredRequestId(requestId);
    if (!shouldRequireEnvelope) {
      return;
    }

    headers[ENVELOPE_HEADER] = buildEnvelopeHeaderValue({
      requestId,
      target: environment.target,
      sourceOrigin: environment.resolveSourceOrigin(incomingHeaders),
      targetOrigin: toOrigin(url),
      traceContext: parseTraceparentValue(
        readHeader(headers, TRACEPARENT_HEADER),
      ),
      allowCrossOriginEnvelope: realAllowCrossOriginEnvelope.get(requestId),
    });
  };

  const attachSecuredOperationHeaders = (
    headers: HeaderMap,
    requestId: string,
    method: string,
    path: string,
    operationContext: RequestCreatorOptions<F>['operationContext'],
  ) => {
    if (!isSecuredRequestId(requestId)) {
      return;
    }
    attachOperationContextHeaders({
      headers,
      requestId,
      target: environment.target,
      method,
      path,
      operationContext,
      operationContract: realOperationContract.get(requestId),
      operationContextHeader: OPERATION_CONTEXT_HEADER,
      operationContextDetailHeader: OPERATION_CONTEXT_DETAIL_HEADER,
    });
  };

  const applyIdentityAndForwardedHeaders = ({
    headers,
    requestId,
    incomingHeaders,
    forwardedHeaders,
    allowedHeaders: targetAllowedHeaders,
  }: RequestHeadersContext) => {
    const identityBinding = realIdentityBinding.get(requestId);
    const identityBindingEnabled =
      identityBinding?.enabled ?? isSecuredRequestId(requestId);
    const identityBindingStrict =
      identityBinding?.strict ?? isSecuredRequestId(requestId);
    const protectedIdentityHeaders = (
      identityBinding?.protectedHeaders ||
      BFF_DEFAULT_PROTECTED_IDENTITY_HEADERS
    ).map(header => header.toLowerCase());

    if (identityBindingEnabled) {
      const derivedIdentityHeaders: HeaderMap = {};
      if (isServerTarget) {
        for (const header of protectedIdentityHeaders) {
          const incomingHeaderValue = readHeader(incomingHeaders, header);
          if (typeof incomingHeaderValue !== 'undefined') {
            writeHeader(derivedIdentityHeaders, header, incomingHeaderValue);
          }
        }
      }

      const customDerivedHeaders = identityBinding?.deriveHeaders?.({
        requestId,
        target: environment.target,
        incomingHeaders: isServerTarget ? { ...incomingHeaders } : {},
        protectedHeaders: [...protectedIdentityHeaders],
      });
      if (customDerivedHeaders && typeof customDerivedHeaders === 'object') {
        for (const header of protectedIdentityHeaders) {
          const customValue = readHeader(customDerivedHeaders, header);
          if (typeof customValue !== 'undefined') {
            writeHeader(derivedIdentityHeaders, header, customValue);
          }
        }
      }

      for (const header of protectedIdentityHeaders) {
        const attemptedValue = readHeader(headers, header);
        if (typeof attemptedValue === 'undefined') {
          continue;
        }

        const violation: IdentityBindingViolation = {
          requestId,
          target: environment.target,
          header,
          attemptedValue,
          derivedValue: readHeader(derivedIdentityHeaders, header),
          reason: 'client_override_blocked',
        };
        identityBinding?.onViolation?.(violation);

        if (identityBindingStrict) {
          throw new IdentityBindingViolationError(violation);
        }

        deleteHeader(headers, header);
      }

      Object.keys(derivedIdentityHeaders).forEach(header => {
        if (isServerTarget) {
          writeHeader(forwardedHeaders, header, derivedIdentityHeaders[header]);
        } else {
          writeHeader(headers, header, derivedIdentityHeaders[header]);
        }
      });
    }

    if (isServerTarget) {
      const resolveHeaders = realResolveHeaders.get(requestId);
      if (resolveHeaders) {
        const resolvedHeaders = resolveHeaders({
          requestId,
          allowedHeaders: targetAllowedHeaders,
          incomingHeaders: { ...forwardedHeaders },
        });
        if (resolvedHeaders && typeof resolvedHeaders === 'object') {
          for (const key of targetAllowedHeaders) {
            const resolvedValue = readHeader(resolvedHeaders, key);
            if (typeof resolvedValue !== 'undefined') {
              if (
                identityBindingEnabled &&
                protectedIdentityHeaders.includes(key.toLowerCase())
              ) {
                writeHeader(forwardedHeaders, key.toLowerCase(), resolvedValue);
                continue;
              }
              writeHeader(forwardedHeaders, key, resolvedValue);
            }
          }
        }
      }
    }

    return headers;
  };

  const configure = (options: IOptions<F>) => {
    const {
      request,
      interceptor,
      allowedHeaders,
      resolveHeaders,
      transport,
      requireEnvelope,
      allowCrossOriginEnvelope,
      identityBinding,
      operationContract,
      setDomain,
      requestId = 'default',
    } = options;

    const hasExistingDomain = domainMap.has(requestId);
    if (requestId !== 'default' && !setDomain && !hasExistingDomain) {
      throw new ProducerDomainNotConfiguredError(requestId);
    }

    let resolvedDomain: string | undefined;
    nativeClient.configure({
      request,
      interceptor,
      allowedHeaders,
      requestId,
      setDomain: setDomain
        ? options => {
            resolvedDomain = setDomain(options);
            if (requestId !== 'default' && isEmptyDomain(resolvedDomain)) {
              throw new ProducerDomainNotConfiguredError(requestId);
            }
            return resolvedDomain;
          }
        : undefined,
    });

    realResolveHeaders.delete(requestId);
    realTransportResilience.delete(requestId);
    realIdentityBinding.delete(requestId);
    realOperationContract.delete(requestId);
    realRequireEnvelope.delete(requestId);
    realAllowCrossOriginEnvelope.delete(requestId);

    if (isServerTarget && typeof resolveHeaders === 'function') {
      realResolveHeaders.set(requestId, resolveHeaders);
    }
    if (transport && typeof transport === 'object') {
      realTransportResilience.set(requestId, transport);
    }
    if (identityBinding && typeof identityBinding === 'object') {
      realIdentityBinding.set(requestId, identityBinding);
    }
    if (operationContract && typeof operationContract === 'object') {
      realOperationContract.set(requestId, operationContract);
    }
    if (typeof requireEnvelope === 'boolean') {
      realRequireEnvelope.set(requestId, requireEnvelope);
    }
    if (
      typeof allowCrossOriginEnvelope === 'boolean' ||
      typeof allowCrossOriginEnvelope === 'function'
    ) {
      realAllowCrossOriginEnvelope.set(requestId, allowCrossOriginEnvelope);
    }
    if (typeof resolvedDomain === 'string') {
      domainMap.set(requestId, resolvedDomain);
    }
    configuredRequests.set(requestId, true);
  };

  const createHooks = (
    path: string,
    method: string,
    requestId: string,
    operationContext: RequestCreatorOptions<F>['operationContext'],
    upload = false,
  ): RequestHooks => ({
    onStart: ({ configuredDomain }) => {
      resolveConfiguredRequest(configuredRequests, requestId, false);
      if (
        !upload &&
        requestId !== 'default' &&
        isEmptyDomain(configuredDomain)
      ) {
        throw new ProducerDomainNotConfiguredError(requestId);
      }
    },
    prepareHeaders: applyIdentityAndForwardedHeaders,
    dispatch: context => {
      const {
        incomingHeaders,
        url,
        init: { headers },
      } = context;
      if (isServerTarget && !upload) {
        if (typeof readHeader(headers, TRACEPARENT_HEADER) === 'undefined') {
          const incomingTraceparent = firstHeaderValue(
            readHeader(incomingHeaders, TRACEPARENT_HEADER),
          );
          if (typeof incomingTraceparent === 'string') {
            writeHeader(headers, TRACEPARENT_HEADER, incomingTraceparent);
          }
        }
        if (
          typeof readHeader(headers, TRACEPARENT_HEADER) === 'undefined' &&
          operationContext?.traceparent
        ) {
          writeHeader(
            headers,
            TRACEPARENT_HEADER,
            operationContext.traceparent,
          );
        }
      }
      attachEnvelopeHeaderIfRequired(headers, requestId, url, incomingHeaders);
      attachSecuredOperationHeaders(
        headers,
        requestId,
        method,
        path,
        operationContext,
      );

      return executeWithResilience({
        requestId,
        target: environment.target,
        method,
        url,
        init: context.init,
        fetcher: context.fetcher,
        transport: realTransportResilience.get(requestId),
      });
    },
  });

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
            operationContext: args[6],
          };
    const {
      operationContext,
      requestId = 'default',
      ...nativeOptions
    } = options;
    return nativeClient.createRequest({
      ...nativeOptions,
      requestId,
      hooks: createHooks(
        options.path,
        options.method,
        requestId,
        operationContext,
      ),
    });
  }) as RequestCreator<F>;

  const createUploader: UploadCreator = ({
    operationContext,
    requestId = 'default',
    ...options
  }) =>
    nativeClient.createUploader({
      ...options,
      requestId,
      hooks: createHooks(
        options.path,
        'POST',
        requestId,
        operationContext,
        true,
      ),
    });

  return { configure, createRequest, createUploader };
};
