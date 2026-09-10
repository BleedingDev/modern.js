import type { CrossProjectPolicyViolationReason } from '@modern-js/server-runtime-extensions/bff-policy';
import {
  assertParityResult,
  createAdapterParityScenarios,
  createParityApiHandlerInfos,
  createParityBffConfig,
  toParityResult,
} from './helpers/bff-policy-parity/parity';

describe('Hono parity fixture table', () => {
  test('defines unique scenarios and covers every adapter-observable strict policy denial', () => {
    const scenarios = createAdapterParityScenarios();
    const names = scenarios.map(scenario => scenario.name);
    expect(new Set(names).size).toBe(names.length);

    const denialReasons = scenarios
      .map(scenario => scenario.expected)
      .filter(
        (
          expected,
        ): expected is {
          kind: 'denied';
          status: number;
          reason: CrossProjectPolicyViolationReason;
        } => expected.kind === 'denied',
      )
      .map(expected => expected.reason)
      .sort();

    expect(denialReasons).toEqual(
      [
        'invalid_envelope',
        'invalid_envelope',
        'invalid_operation_context_details',
        'invalid_operation_context_details',
        'missing_envelope',
        'missing_operation_context',
        'missing_operation_context_details',
        'missing_operation_schema_hash',
        'missing_operation_version',
        'missing_request_id',
        'namespace_not_allowed',
        'operation_context_details_request_id_mismatch',
        'operation_context_mismatch',
        'operation_schema_hash_mismatch',
        'operation_version_mismatch',
      ].sort(),
    );
  });

  test('builds strict policy config and fixture handlers for adapter tests', () => {
    expect(createParityBffConfig()).toEqual({
      requestId: 'crm.producer-a',
      crossProjectPolicy: {
        enabled: true,
        allowedNamespaces: ['crm'],
        verifyProducerIdentity: expect.any(Function),
      },
    });
    expect(createParityApiHandlerInfos().map(handler => handler.name)).toEqual([
      'getHello',
      'postHello',
      'getNothing',
      'postEcho',
      'getItem',
      'patchSchema',
    ]);
  });

  test('normalizes adapter HTTP responses before parity comparison', () => {
    expect(
      toParityResult({
        status: 200,
        type: 'application/json',
        body: { ok: true },
        text: '{"ok":true}',
      }),
    ).toEqual({ status: 200, payload: { ok: true } });
    expect(
      toParityResult({
        status: 200,
        type: 'text/plain',
        body: undefined,
        text: '',
      }),
    ).toEqual({ status: 200, payload: undefined });
  });

  test('asserts payload and denial expectations', () => {
    const [payloadScenario] = createAdapterParityScenarios();
    assertParityResult(payloadScenario!, {
      status: 200,
      type: 'application/json',
      body: { message: 'hello' },
      text: '{"message":"hello"}',
    });

    const deniedScenario = createAdapterParityScenarios().find(
      scenario => scenario.name === 'policy denies missing envelope',
    )!;
    assertParityResult(deniedScenario, {
      status: 403,
      type: 'application/json',
      body: {
        code: 'BFF_CROSS_PROJECT_POLICY_DENIED',
        reason: 'missing_envelope',
        message: 'missing',
      },
      text: '',
    });

    const driftScenario = createAdapterParityScenarios().find(
      scenario => scenario.name === 'plain handler returning undefined',
    )!;
    assertParityResult(driftScenario, {
      status: 404,
      type: 'text/plain',
      body: undefined,
      text: '404 Not Found',
    });
  });
});
