// @effect-diagnostics asyncFunction:off strictBooleanExpressions:off
/** Shared endpoint normalization and identity hashing for server policy metadata. */
import {
  createOperationContractHash,
  type OperationContractSource,
} from '@modern-js/server-runtime-extensions/bff-policy/node';
import {
  classifyEffectBffEntryModule,
  isValidatorAwareHandlerFactory,
} from './entry-shape';

export type EffectEndpointMeta = {
  apiId: string;
  groupName: string;
  endpointName: string;
  method: string;
  routePath: string;
};

export type HttpApiLike = {
  identifier?: unknown;
};

type HttpApiGroupLike = {
  identifier?: unknown;
};

type HttpApiEndpointLike = {
  identifier?: unknown;
  method?: unknown;
  path?: unknown;
};

function resolveEffectEndpointName(endpoint: HttpApiEndpointLike): string {
  if (typeof endpoint.identifier === 'string' && endpoint.identifier) {
    return endpoint.identifier;
  }
  return '';
}

export type HttpApiReflect = (
  api: unknown,
  handlers: {
    /** Group metadata is unused by contract collection; kept as a no-op. */
    onGroup?: () => void;
    onEndpoint: (input: {
      group: HttpApiGroupLike;
      endpoint: HttpApiEndpointLike;
    }) => void;
  },
) => void;

export function ensureLeadingSlash(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function normalizeEffectPrefix(prefix: string) {
  if (prefix === '/') {
    return '';
  }
  return ensureLeadingSlash(prefix || '/api');
}

function getEffectRoutePath(prefix: string, endpointPath: string) {
  const normalizedPrefix = normalizeEffectPrefix(prefix);
  const normalizedEndpointPath = ensureLeadingSlash(endpointPath);
  const finalEndpointPath = normalizedEndpointPath === '/' ? '' : endpointPath;
  if (!normalizedPrefix && !finalEndpointPath) {
    return '/';
  }
  return `${normalizedPrefix}${finalEndpointPath || ''}`;
}

function resolveEffectApiId(api: HttpApiLike): string {
  const fallback = 'EffectHttpApi';
  if (
    'identifier' in api &&
    typeof api.identifier === 'string' &&
    api.identifier
  ) {
    return api.identifier;
  }
  return fallback;
}

export function collectEffectEndpoints(
  reflect: HttpApiReflect,
  api: HttpApiLike,
  prefix: string,
): EffectEndpointMeta[] {
  const endpoints: EffectEndpointMeta[] = [];
  const apiId = resolveEffectApiId(api);
  reflect(api, {
    onGroup: () => {
      // no-op
    },
    onEndpoint: ({ group, endpoint }) => {
      endpoints.push({
        apiId,
        groupName: String(group.identifier),
        endpointName: resolveEffectEndpointName(endpoint),
        method: String(endpoint.method).toUpperCase(),
        routePath: getEffectRoutePath(prefix, String(endpoint.path)),
      });
    },
  });
  return endpoints.sort((a, b) => {
    if (a.groupName === b.groupName) {
      return a.endpointName.localeCompare(b.endpointName);
    }
    return a.groupName.localeCompare(b.groupName);
  });
}

/**
 * Maps reflected endpoints onto operation-contract sources for
 * `buildOperationContractMap`/`resolveCrossProjectPolicy`. Effect endpoints
 * carry no zod metadata, so the contract hash covers the endpoint identity.
 */
export function toOperationContractSources(
  endpoints: EffectEndpointMeta[],
): OperationContractSource[] {
  return endpoints.map(createEffectOperationContractSource);
}

function createEffectOperationContractSource(
  endpoint: EffectEndpointMeta,
): OperationContractSource {
  return {
    name: endpoint.endpointName,
    httpMethod: endpoint.method,
    routePath: endpoint.routePath,
  };
}

/**
 * Extracts the HttpApi instance from a loaded effect entry module. Mirrors
 * the shared entry-shape policy accepted by `resolveEffectBffModuleHandler`,
 * without executing factories during contract extraction.
 */
export async function extractHttpApiFromModule(
  mod: unknown,
  isHttpApi: (value: unknown) => boolean,
): Promise<HttpApiLike | null> {
  const facts = classifyEffectBffEntryModule(mod, {
    isRequestHandler: value => typeof value === 'function',
    isValidatorAwareHandlerFactory,
    isHttpApi,
  });
  return facts?.unsupportedShape ||
    facts?.api === undefined ||
    !facts.hasRuntimeLayer ||
    (facts.createHandler !== undefined && !facts.createHandlerValidatorAware)
    ? null
    : (facts.api as HttpApiLike);
}

/**
 * Per-endpoint contract hash; MUST stay in sync with the server-side
 * contract map (it is the same bff-core hash over the same inputs).
 */
export function createEffectEndpointContractHash(
  endpoint: EffectEndpointMeta,
  requestId: string,
): string {
  return createOperationContractHash(
    createEffectOperationContractSource(endpoint),
    requestId,
  );
}
