import {
  attachOperationContextHeaders,
  buildEnvelopeHeaderValue,
  buildOperationContext,
  CrossOriginEnvelopePolicyError,
  deleteHeader,
  findHeaderKey,
  isSecuredRequestId,
  OperationContractViolationError,
  readHeader,
  validateOperationContract,
  writeHeader,
} from '../../src/request-policy/policyCore';

describe('policyCore (shared browser/node policy module)', () => {
  test('header helpers are case-insensitive and normalize duplicate keys', () => {
    const headers: Record<string, any> = { 'X-Foo': 'a' };

    expect(findHeaderKey(headers, 'x-foo')).toBe('X-Foo');
    expect(readHeader(headers, 'x-FOO')).toBe('a');

    writeHeader(headers, 'x-foo', 'b');
    expect(headers).toEqual({ 'x-foo': 'b' });

    deleteHeader(headers, 'X-FOO');
    expect(headers).toEqual({});
  });

  test('isSecuredRequestId treats only "default" as unsecured by default', () => {
    expect(isSecuredRequestId('default')).toBe(false);
    expect(isSecuredRequestId('crm-producer')).toBe(true);
  });

  test('validateOperationContract throws on missing schema hash for secured ids', () => {
    const contextPayload = buildOperationContext({
      requestId: 'crm',
      method: 'GET',
      path: '/hello',
    });

    expect(() =>
      validateOperationContract({
        requestId: 'crm',
        target: 'browser',
        contextPayload,
        operationContract: undefined,
      }),
    ).toThrow(OperationContractViolationError);
  });

  test('buildEnvelopeHeaderValue denies cross-origin flows unless allowed', () => {
    expect(() =>
      buildEnvelopeHeaderValue({
        requestId: 'crm',
        target: 'server',
        sourceOrigin: 'https://a.example',
        targetOrigin: 'https://b.example',
        traceContext: undefined,
        allowCrossOriginEnvelope: undefined,
      }),
    ).toThrow(CrossOriginEnvelopePolicyError);

    const envelope = JSON.parse(
      buildEnvelopeHeaderValue({
        requestId: 'crm',
        target: 'server',
        sourceOrigin: 'https://a.example',
        targetOrigin: 'https://b.example',
        traceContext: { traceId: 't', spanId: 's' },
        allowCrossOriginEnvelope: true,
      }),
    );
    expect(envelope).toMatchObject({
      requestId: 'crm',
      target: 'server',
      sourceOrigin: 'https://a.example',
      targetOrigin: 'https://b.example',
      traceId: 't',
      spanId: 's',
    });
  });

  test('buildEnvelopeHeaderValue requires cross-origin predicate to return true', () => {
    const allowCrossOriginEnvelope = () => 'yes';

    expect(() =>
      buildEnvelopeHeaderValue({
        requestId: 'crm',
        target: 'server',
        sourceOrigin: 'https://a.example',
        targetOrigin: 'https://b.example',
        traceContext: undefined,
        allowCrossOriginEnvelope:
          allowCrossOriginEnvelope as unknown as () => boolean,
      }),
    ).toThrow(CrossOriginEnvelopePolicyError);
  });

  test('attachOperationContextHeaders writes id and detail headers without clobbering caller id', () => {
    const headers: Record<string, any> = {
      'x-operation-id': 'crm:custom-op',
    };

    attachOperationContextHeaders({
      headers,
      requestId: 'crm',
      target: 'server',
      method: 'GET',
      path: '/hello',
      operationContext: {
        operationId: 'getHello',
        schemaHash: 'abc',
        operationVersion: 1,
      },
      operationContract: undefined,
      operationContextHeader: 'x-operation-id',
      operationContextDetailHeader: 'x-modernjs-bff-operation-context',
    });

    expect(headers['x-operation-id']).toBe('crm:custom-op');
    const details = JSON.parse(headers['x-modernjs-bff-operation-context']);
    expect(details).toMatchObject({
      requestId: 'crm',
      operationId: 'crm:getHello',
      schemaHash: 'abc',
      operationVersion: 1,
    });
  });
});
