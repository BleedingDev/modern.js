import { createRequire } from 'node:module';
import * as dataPlatform from '@modern-js/bff-effect/data-platform';
import * as effectClient from '@modern-js/bff-effect/effect-client';
import * as effectEdgeDispatcher from '@modern-js/bff-effect/effect-edge';

import * as compatibleDataPlatform from '../src/data-platform/codec';
import * as compatibleEffectEdgeDispatcher from '../src/effect/edge-dispatcher';
import * as compatibleEffectClient from '../src/effect-client';

describe('canonical Effect runtime package identity', () => {
  test('preserves the implementation function identity through public exports', () => {
    expect(compatibleDataPlatform.createOperationId).toBe(
      dataPlatform.createOperationId,
    );
    expect(compatibleEffectClient.makeEffectHttpApiClient).toBe(
      effectClient.makeEffectHttpApiClient,
    );
    expect(compatibleEffectEdgeDispatcher.createEffectBffEdgeDispatcher).toBe(
      effectEdgeDispatcher.createEffectBffEdgeDispatcher,
    );
  });
});

describe('canonical Effect runtime namespaces', () => {
  test('exposes RPC and data-platform APIs from their owning package', () => {
    const require = createRequire(import.meta.url);
    const effectEntry = require('@modern-js/bff-effect/effect') as {
      defineEffectRpcBff?: unknown;
    };
    const dataPlatformEntry =
      require('@modern-js/bff-effect/data-platform') as Record<string, unknown>;
    expect(effectEntry.defineEffectRpcBff).toBeTypeOf('function');
    for (const name of [
      'buildQueryKey',
      'buildScopeKey',
      'createHydrationEnvelope',
      'createInvalidationEvent',
      'createOperationId',
      'createRequestEnvelope',
      'deriveChildTraceContext',
      'shouldApplyInvalidation',
      'validateHydrationEnvelope',
      'validateRequestEnvelope',
    ]) {
      expect(dataPlatformEntry[name]).toBeTypeOf('function');
    }
  });
});
