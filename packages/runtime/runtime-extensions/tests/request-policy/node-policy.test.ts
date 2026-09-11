import {
  CrossOriginEnvelopePolicyError,
  configure,
  createRequest,
  IdentityBindingViolationError,
  OperationContractViolationError,
  ProducerClientNotInitializedError,
  ProducerDomainNotConfiguredError,
} from '@modern-js/runtime-extensions/request-policy';
import { storage } from '@modern-js/runtime-utils/node';
import nock from 'nock';

describe('configure', () => {
  const path = '/api';
  const method = 'GET';
  const response = {
    code: 200,
    data: {
      message: 'hello Modernjs',
    },
  };

  const run = (
    headers: Record<string, string>,
    callback: () => Promise<void> | void,
  ) =>
    storage.run(
      {
        headers,
        monitors: {} as any,
      },
      callback,
    );

  // beforeEach(() => {
  //   nock.disableNetConnect();
  // });

  // afterEach(() => {
  //   nock.cleanAll();
  // });

  test('should support inputParams for non-default requestId with configured domain', async () => {
    const producer = 'producer-input-params';
    const producerUrl = 'http://127.0.0.1:9091';

    await run({}, async () => {
      nock(producerUrl).post(path, 'modernjs').reply(200, response);

      configure({
        requestId: producer,
        operationContract: {
          enabled: false,
        },
        setDomain: () => producerUrl,
      });

      const request = createRequest(
        path,
        'POST',
        8080,
        'inputParams',
        undefined,
        producer,
      );
      const data = await request('modernjs');
      expect(data).toStrictEqual(response);
    });
  });

  test('should throw for non-default requestId when producer client is not initialized', async () => {
    const request = createRequest({
      path,
      method,
      port: 8080,
      requestId: 'producer-app',
    });

    expect(() => request()).toThrow(ProducerClientNotInitializedError);
  });

  test('should require setDomain when configuring non-default requestId', () => {
    expect(() =>
      configure({
        requestId: 'producer-a',
      }),
    ).toThrow(ProducerDomainNotConfiguredError);
  });

  test('should support secure resolveHeaders callback for non-default requestId', async () => {
    const producer = 'producer-with-resolver';
    const authKey = 'token-def';
    const tenant = 'tenant-a';
    const producerUrl = 'http://127.0.0.1:9084';

    await run(
      {
        authorization: authKey,
        'x-tenant-id': tenant,
      },
      async () => {
        nock(producerUrl, {
          reqheaders: {
            authorization: authKey,
            'x-tenant-id': 'tenant-masked',
          },
        })
          .get(path)
          .reply(200, response);

        configure({
          requestId: producer,
          allowedHeaders: ['authorization', 'x-tenant-id'],
          operationContract: {
            enabled: false,
          },
          resolveHeaders: ({ incomingHeaders }) => ({
            ...incomingHeaders,
            'x-tenant-id': 'tenant-masked',
            'x-injected': 'blocked',
          }),
          setDomain: () => producerUrl,
        });

        const request = createRequest(
          path,
          method,
          8080,
          undefined,
          undefined,
          producer,
        );
        const data = await request();

        expect(data).toStrictEqual(response);
      },
    );
  });

  test('should reject client-supplied tenant headers by default for non-default producer clients', async () => {
    const producer = 'producer-identity-strip';
    const producerUrl = 'http://127.0.0.1:9085';

    await run({}, async () => {
      nock(producerUrl, {
        badheaders: ['x-tenant-id'],
      })
        .get(path)
        .reply(200, response);

      configure({
        requestId: producer,
        operationContract: {
          enabled: false,
        },
        setDomain: () => producerUrl,
      });

      const request = createRequest(
        path,
        method,
        8080,
        undefined,
        undefined,
        producer,
      );

      expect(() =>
        request({
          headers: {
            'x-tenant-id': 'tenant-client',
          },
        }),
      ).toThrow(IdentityBindingViolationError);
    });
  });

  test('should enforce server-derived tenant and subject context over client overrides', async () => {
    const producer = 'producer-identity-derived';
    const producerUrl = 'http://127.0.0.1:9086';

    await run(
      {
        'x-tenant-id': 'tenant-server',
        'x-subject-id': 'subject-server',
      },
      async () => {
        nock(producerUrl, {
          reqheaders: {
            'x-tenant-id': 'tenant-server',
            'x-subject-id': 'subject-server',
          },
        })
          .get(path)
          .reply(200, response);

        configure({
          requestId: producer,
          operationContract: {
            enabled: false,
          },
          identityBinding: {
            strict: false,
          },
          setDomain: () => producerUrl,
        });

        const request = createRequest(
          path,
          method,
          8080,
          undefined,
          undefined,
          producer,
        );

        const data = await request({
          headers: {
            'x-tenant-id': 'tenant-client',
            'x-subject-id': 'subject-client',
          },
        });

        expect(data).toStrictEqual(response);
      },
    );
  });

  test('should reject client identity override in strict identity binding mode', () => {
    const producer = 'producer-identity-strict';

    configure({
      requestId: producer,
      setDomain: () => 'http://127.0.0.1:9087',
      operationContract: {
        enabled: false,
      },
      identityBinding: {
        strict: true,
      },
    });

    const request = createRequest(
      path,
      method,
      8080,
      undefined,
      undefined,
      producer,
    );

    expect(() =>
      request({
        headers: {
          'x-tenant-id': 'tenant-client',
        },
      }),
    ).toThrow(IdentityBindingViolationError);
  });

  test('should require envelope and block cross-origin producer calls in production by default', async () => {
    const producer = 'producer-envelope-default';
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await run(
      {
        origin: 'https://consumer.internal',
      },
      async () => {
        try {
          configure({
            requestId: producer,
            operationContract: {
              enabled: false,
            },
            setDomain: () => 'https://producer.internal',
          });

          const request = createRequest(
            path,
            method,
            8080,
            undefined,
            undefined,
            producer,
          );

          expect(() => request()).toThrow(CrossOriginEnvelopePolicyError);
        } finally {
          process.env.NODE_ENV = previousEnv;
        }
      },
    );
  });

  test('should allow explicit cross-origin envelope policy and attach envelope header', async () => {
    const producer = 'producer-envelope-policy';
    const producerUrl = 'https://producer.internal';
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await run(
      {
        origin: 'https://consumer.internal',
      },
      async () => {
        try {
          nock(producerUrl).get(path).reply(200, response);
          const customRequest = rs.fn((requestPath: any, init: any) =>
            fetch(requestPath, init),
          );

          configure({
            request: customRequest as unknown as typeof fetch,
            requestId: producer,
            operationContract: {
              enabled: false,
            },
            setDomain: () => producerUrl,
            allowCrossOriginEnvelope: ({
              requestId,
              sourceOrigin,
              targetOrigin,
            }) =>
              requestId === producer &&
              sourceOrigin === 'https://consumer.internal' &&
              targetOrigin === producerUrl,
          });

          const request = createRequest(
            path,
            method,
            8080,
            undefined,
            undefined,
            producer,
          );
          const res = await request();
          const data = await res.json();

          const headers = customRequest.mock.calls[0]?.[1]?.headers;
          const envelope = JSON.parse(headers['x-modernjs-bff-envelope']);
          expect(envelope.requestId).toBe(producer);
          expect(envelope.target).toBe('server');
          expect(data).toStrictEqual(response);
        } finally {
          process.env.NODE_ENV = previousEnv;
        }
      },
    );
  });

  test('should attach operation context headers for non-default producer client', async () => {
    const producer = 'crm.producer-a';
    const producerUrl = 'http://127.0.0.1:18080';
    const traceparent =
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

    await run({ traceparent }, async () => {
      nock(producerUrl).get(path).reply(200, response);
      const customRequest = rs.fn((requestPath: any, init: any) =>
        fetch(requestPath, init),
      );

      configure({
        request: customRequest as unknown as typeof fetch,
        requestId: producer,
        setDomain: () => producerUrl,
      });

      const request = createRequest(
        path,
        method,
        8080,
        undefined,
        undefined,
        producer,
        {
          operationId: `GET:${path}`,
          routePath: path,
          method,
          schemaHash: 'schema-test',
          operationVersion: 1,
          traceparent,
        },
      );
      await request();

      const headers = customRequest.mock.calls[0]?.[1]?.headers;
      expect(headers['x-operation-id']).toBe(`${producer}:GET:${path}`);
      expect(headers.traceparent).toBe(traceparent);
      const operationContext = JSON.parse(
        headers['x-modernjs-bff-operation-context'],
      );
      expect(operationContext.requestId).toBe(producer);
      expect(operationContext.operationId).toBe(`${producer}:GET:${path}`);
      expect(operationContext.traceparent).toBe(traceparent);
      expect(operationContext.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(operationContext.spanId).toBe('00f067aa0ba902b7');
    });
  });

  test('should reject requests missing schema/version operation contract metadata by default', () => {
    const producer = 'producer-operation-contract-default';

    configure({
      requestId: producer,
      setDomain: () => 'http://127.0.0.1:19080',
    });

    const request = createRequest(
      path,
      method,
      8080,
      undefined,
      undefined,
      producer,
    );

    expect(() => request()).toThrow(OperationContractViolationError);
  });

  test('should enforce operation contract metadata for default requestId when strict-default mode is enabled', () => {
    process.env.MODERN_BFF_STRICT_DEFAULT_REQUEST_ID = 'true';
    try {
      configure({
        operationContract: {
          enabled: true,
          strict: true,
          requireSchemaHash: true,
          requireOperationVersion: true,
        },
      });

      const request = createRequest(path, method, 8080);
      expect(() => request()).toThrow(OperationContractViolationError);
    } finally {
      configure({
        operationContract: {
          enabled: false,
        },
      });
      delete process.env.MODERN_BFF_STRICT_DEFAULT_REQUEST_ID;
    }
  });
});
