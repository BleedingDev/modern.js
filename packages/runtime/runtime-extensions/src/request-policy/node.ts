import { createClient as createNativeClient } from '@modern-js/create-request/server';
import { createPolicyClient } from './client';
import { firstHeaderValue, toOrigin } from './policyCore';

const resolveSourceOrigin = (headers: Record<string, any>) => {
  const origin = toOrigin(firstHeaderValue(headers.origin) as string);
  if (origin) {
    return origin;
  }

  const referer = toOrigin(firstHeaderValue(headers.referer) as string);
  if (referer) {
    return referer;
  }

  const host = firstHeaderValue(headers.host);
  if (!host) {
    return undefined;
  }
  const proto = firstHeaderValue(headers['x-forwarded-proto']) || 'http';
  return `${proto}://${host}`;
};

/** Create a server producer client with its own configuration and policy. */
export const createClient = () =>
  createPolicyClient(createNativeClient(), {
    target: 'server',
    resolveSourceOrigin,
  });

export const { configure, createRequest, createUploader } = createClient();

export {
  CrossOriginEnvelopePolicyError,
  IdentityBindingViolationError,
  OperationContractViolationError,
  ProducerClientNotInitializedError,
  ProducerDomainNotConfiguredError,
} from './policyCore';
export * from './requestContext';
export * from './types';
