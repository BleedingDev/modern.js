import { evaluateNodeBackendFederationCommonJs } from '@modern-js/server-runtime-extensions/backend-federation-security/node';

import { loadBackendFederatedEffectApi as loadUniversalBackendFederatedEffectApi } from './load';
import type {
  BackendFederatedEffectApiModule,
  BackendFederationIdentityLoadOptions,
  BackendFederationLoadOptions,
} from './types';

export function loadBackendFederatedEffectApi(
  options: BackendFederationIdentityLoadOptions,
): Promise<BackendFederatedEffectApiModule> {
  return loadUniversalBackendFederatedEffectApi({
    ...options,
    entryPolicy: {
      ...options.entryPolicy,
      evaluateCommonJs:
        options.entryPolicy?.evaluateCommonJs ??
        evaluateNodeBackendFederationCommonJs,
    },
  });
}
