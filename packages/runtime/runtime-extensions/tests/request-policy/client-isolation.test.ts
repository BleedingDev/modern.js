import { createClient as createNativeClient } from '@modern-js/create-request/server';
import * as context from '@modern-js/runtime-extensions/request-context';
import * as canonical from '@modern-js/runtime-extensions/request-policy';
import * as server from '@modern-js/runtime-extensions/request-policy/server';

const options = {
  path: '/api',
  method: 'GET',
  port: 8080,
  requestId: 'shared-producer',
};

describe('isolated producer policy clients', () => {
  test('does not share producer initialization or request configuration between instances', async () => {
    const first = server.createClient();
    const second = server.createClient();
    const firstRequest = rs.fn(async () => new Response('first'));
    const secondRequest = rs.fn(async () => new Response('second'));
    first.configure({
      requestId: options.requestId,
      request: firstRequest,
      setDomain: () => 'https://first.example',
      operationContract: { enabled: false },
    });
    expect(() => second.createRequest(options)()).toThrow(
      server.ProducerClientNotInitializedError,
    );
    second.configure({
      requestId: options.requestId,
      request: secondRequest,
      setDomain: () => 'https://second.example',
      operationContract: { enabled: false },
    });
    expect(await (await first.createRequest(options)()).text()).toBe('first');
    expect(await (await second.createRequest(options)()).text()).toBe('second');
    expect(firstRequest).toHaveBeenCalledWith(
      'https://first.example/api',
      expect.any(Object),
    );
    expect(secondRequest).toHaveBeenCalledWith(
      'https://second.example/api',
      expect.any(Object),
    );
  });

  test('does not initialize producer policy by configuring a separate native client', () => {
    createNativeClient().configure({
      requestId: options.requestId,
      request: rs.fn(),
    });
    const producer = server.createClient();
    expect(() => producer.createRequest(options)()).toThrow(
      server.ProducerClientNotInitializedError,
    );
  });

  test('retains secured behavior for an explicitly empty requestId', () => {
    const client = server.createClient();
    const request = rs.fn();
    client.configure({
      requestId: '',
      request,
      setDomain: () => 'https://producer.example',
    });
    expect(() => client.createRequest({ ...options, requestId: '' })()).toThrow(
      server.OperationContractViolationError,
    );
    expect(request).not.toHaveBeenCalled();
  });

  test('calls setDomain once after interceptor and keeps native and policy state on rejection', async () => {
    const client = server.createClient();
    const order: string[] = [];
    const request = rs.fn(async () => new Response('original'));
    const setDomain = rs.fn(() => {
      order.push('domain');
      return 'https://original.example';
    });
    client.configure({
      requestId: options.requestId,
      interceptor: () => {
        order.push('interceptor');
        return request;
      },
      setDomain,
      requireEnvelope: false,
      operationContract: { enabled: false },
    });
    const replacement = rs.fn();
    expect(() =>
      client.configure({
        requestId: options.requestId,
        request: replacement,
        setDomain: () => '',
      }),
    ).toThrow(server.ProducerDomainNotConfiguredError);
    const response = await client.createRequest(options)();
    expect(await response.text()).toBe('original');
    expect(order).toEqual(['interceptor', 'domain']);
    expect(setDomain).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      'https://original.example/api',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'x-modernjs-bff-envelope': expect.anything(),
        }),
      }),
    );
    expect(replacement).not.toHaveBeenCalled();
  });

  test('shares source configure across canonical require/import and explicit server', async () => {
    const required: typeof canonical = require('@modern-js/runtime-extensions/request-policy');
    expect(required.configure).toBe(canonical.configure);
    expect(server.configure).toBe(canonical.configure);
    const request = rs.fn(async () => new Response('shared'));
    required.configure({
      requestId: options.requestId,
      request,
      setDomain: () => 'https://shared.example',
      operationContract: { enabled: false },
    });
    expect(await (await canonical.createRequest(options)()).text()).toBe(
      'shared',
    );
    canonical.configure({
      requestId: options.requestId,
      request,
      setDomain: () => 'https://updated.example',
      operationContract: { enabled: false },
    });
    await required.createRequest(options)();
    expect(request).toHaveBeenLastCalledWith(
      'https://updated.example/api',
      expect.any(Object),
    );
  });

  test('exports universal context helpers without a request client', () => {
    expect(context.createRequestContextHeaders).toBe(
      canonical.createRequestContextHeaders,
    );
    expect(context.parseTraceparent).toBe(canonical.parseTraceparent);
    expect(context).not.toHaveProperty('configure');
    expect(context).not.toHaveProperty('createClient');
    expect(context).not.toHaveProperty('createRequest');
    expect(context).not.toHaveProperty('createUploader');
  });
});
