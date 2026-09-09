import { createClient as createNativeClient } from '@modern-js/create-request/client';
import { createPolicyClient } from './client';

/** Create a browser producer client with its own configuration and policy. */
export const createClient = () =>
  createPolicyClient(createNativeClient(), {
    target: 'browser',
    resolveSourceOrigin: () =>
      typeof window !== 'undefined' ? window.location.origin : undefined,
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
