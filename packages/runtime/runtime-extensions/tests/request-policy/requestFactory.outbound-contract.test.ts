import { createClient as createBrowserClient } from '@modern-js/runtime-extensions/request-policy/client';
import { createClient as createServerClient } from '@modern-js/runtime-extensions/request-policy/server';
import { storage } from '@modern-js/runtime-utils/node';
import {
  BFF_ENVELOPE_HEADER,
  BFF_OPERATION_CONTEXT_DETAIL_HEADER,
  BFF_OPERATION_CONTEXT_HEADER,
  type TransportTarget,
} from '../../src/request-policy/types';

const ACCEPT_HEADER = 'application/json,*/*;q=0.8';
const REQUEST_PATH = '/api/widgets';
const PORT = 8080;
const SERVER_URL = `http://127.0.0.1:${PORT}${REQUEST_PATH}`;
const PRODUCER_URL = `https://producer.example${REQUEST_PATH}`;
const CONSUMER_ORIGIN = 'https://consumer.example';
const INCOMING_TRACEPARENT =
  '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
const OPERATION_TRACEPARENT =
  '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01';

type HeaderMap = Record<string, any>;

const createHarness = (
  target: TransportTarget,
  incomingHeaders: HeaderMap = {},
) => {
  const request = rs.fn(
    (_requestPath: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }))),
  );

  rs.spyOn(storage, 'useContext').mockReturnValue({ headers: incomingHeaders });
  const requestFactory =
    target === 'server' ? createServerClient() : createBrowserClient();

  return { request, requestFactory };
};

describe('requestFactory outbound request contract', () => {
  test('browser GET drops the caller body, canonicalizes accept and withholds the incoming traceparent', async () => {
    const { request, requestFactory } = createHarness('browser', {
      traceparent: INCOMING_TRACEPARENT,
    });
    requestFactory.configure({ request: request as unknown as typeof fetch });

    const send = requestFactory.createRequest({
      path: REQUEST_PATH,
      method: 'GET',
      port: PORT,
    });
    await send({
      body: 'drop-me',
      headers: { Accept: 'application/problem+json' },
    });

    const [url, init] = request.mock.calls[0];
    expect(String(url)).toBe(REQUEST_PATH);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    const headers = init.headers as HeaderMap;
    expect(headers.accept).toBe(ACCEPT_HEADER);
    expect(
      Object.keys(headers).filter(key => key.toLowerCase() === 'accept'),
    ).toEqual(['accept']);
    expect(headers.traceparent).toBeUndefined();
  });

  test('server POST keeps the caller body and propagates the incoming traceparent', async () => {
    const { request, requestFactory } = createHarness('server', {
      traceparent: INCOMING_TRACEPARENT,
    });
    requestFactory.configure({ request: request as unknown as typeof fetch });

    const send = requestFactory.createRequest({
      path: REQUEST_PATH,
      method: 'POST',
      port: PORT,
    });
    await send({ body: 'keep-me' });

    const [url, init] = request.mock.calls[0];
    expect(String(url)).toBe(SERVER_URL);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('keep-me');
    expect((init.headers as HeaderMap).traceparent).toBe(INCOMING_TRACEPARENT);
  });

  test('secured producer request emits the cross-origin envelope and operation context', async () => {
    const requestId = 'producer-checkout';
    const { request, requestFactory } = createHarness('server', {
      origin: CONSUMER_ORIGIN,
    });

    requestFactory.configure({
      request: request as unknown as typeof fetch,
      requestId,
      setDomain: () => 'https://producer.example',
      requireEnvelope: true,
      allowCrossOriginEnvelope: true,
      operationContract: {
        enabled: true,
        requireSchemaHash: true,
        requireOperationVersion: true,
      },
    });

    const send = requestFactory.createRequest({
      path: REQUEST_PATH,
      method: 'POST',
      port: PORT,
      requestId,
      operationContext: {
        operationId: 'create-widget',
        routePath: REQUEST_PATH,
        method: 'POST',
        schemaHash: 'sha256:create-widget',
        operationVersion: 3,
        traceparent: OPERATION_TRACEPARENT,
      },
    });
    await send({ body: 'keep-me' });

    const [url, init] = request.mock.calls[0];
    expect(String(url)).toBe(PRODUCER_URL);
    const headers = init.headers as HeaderMap;
    expect(headers.traceparent).toBe(OPERATION_TRACEPARENT);
    expect(headers[BFF_OPERATION_CONTEXT_HEADER]).toBe(
      'producer-checkout:create-widget',
    );
    expect(JSON.parse(headers[BFF_ENVELOPE_HEADER])).toMatchObject({
      requestId,
      target: 'server',
      sourceOrigin: CONSUMER_ORIGIN,
      targetOrigin: 'https://producer.example',
      traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      spanId: 'bbbbbbbbbbbbbbbb',
    });
    expect(
      JSON.parse(headers[BFF_OPERATION_CONTEXT_DETAIL_HEADER]),
    ).toMatchObject({
      operationId: 'producer-checkout:create-widget',
      schemaHash: 'sha256:create-widget',
      operationVersion: 3,
    });
  });

  test('forwards only allowlisted and server-derived identity headers', async () => {
    const requestId = 'producer-input-params-identity';
    const { request, requestFactory } = createHarness('server', {
      'x-tenant-id': 'tenant-server',
      'x-subject-id': 'subject-server',
      'x-forwarded-feature': 'feature-server',
      'x-private-incoming': 'must-not-forward',
    });

    requestFactory.configure({
      request: request as unknown as typeof fetch,
      requestId,
      allowedHeaders: ['x-forwarded-feature'],
      operationContract: { enabled: false },
      requireEnvelope: false,
      setDomain: () => 'https://producer.example',
    });

    const send = requestFactory.createRequest({
      path: REQUEST_PATH,
      method: 'POST',
      port: PORT,
      httpMethodDecider: 'inputParams',
      requestId,
    });
    await send('widget');

    const headers = request.mock.calls[0][1]?.headers as HeaderMap;
    expect(headers).toMatchObject({
      'x-tenant-id': 'tenant-server',
      'x-subject-id': 'subject-server',
      'x-forwarded-feature': 'feature-server',
    });
    expect(headers['x-private-incoming']).toBeUndefined();
  });

  test('uploader sends the file as form data under the same header policy', async () => {
    const requestId = 'producer-uploader-identity';
    const { request, requestFactory } = createHarness('server', {
      origin: CONSUMER_ORIGIN,
      'x-tenant-id': 'tenant-server',
      'x-private-incoming': 'must-not-forward',
    });

    requestFactory.configure({
      request: request as unknown as typeof fetch,
      requestId,
      operationContract: { enabled: false },
      requireEnvelope: false,
      setDomain: () => 'https://producer.example',
    });

    const upload = requestFactory.createUploader({
      path: REQUEST_PATH,
      requestId,
    });
    await upload({
      files: {
        file: new File(['widget'], 'widget.txt', { type: 'text/plain' }),
      },
    });

    const [, init] = request.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const uploaded = (init.body as FormData).get('file') as File;
    expect(uploaded.name).toBe('widget.txt');
    expect(await uploaded.text()).toBe('widget');
    const headers = init.headers as HeaderMap;
    expect(headers['x-tenant-id']).toBe('tenant-server');
    expect(headers['x-private-incoming']).toBeUndefined();
  });

  test('resolved headers replace caller and incoming values without injecting unlisted ones', async () => {
    const resolveHeaders = rs.fn(() => ({
      AUTHORIZATION: 'Bearer resolved',
      'x-injected': 'must-not-forward',
    }));
    const { request, requestFactory } = createHarness('server', {
      Authorization: 'Bearer incoming',
    });

    requestFactory.configure({
      request: request as unknown as typeof fetch,
      allowedHeaders: ['authorization'],
      resolveHeaders,
    });

    const send = requestFactory.createRequest({
      path: REQUEST_PATH,
      method: 'GET',
      port: PORT,
    });
    await send({ headers: { Authorization: 'Bearer caller' } });

    expect(resolveHeaders).toHaveBeenCalledWith(
      expect.objectContaining({
        incomingHeaders: { authorization: 'Bearer incoming' },
      }),
    );
    const headers = request.mock.calls[0][1]?.headers as HeaderMap;
    expect(headers.authorization).toBe('Bearer resolved');
    expect(headers['x-injected']).toBeUndefined();
    expect(
      Object.keys(headers).filter(key => key.toLowerCase() === 'authorization'),
    ).toEqual(['authorization']);
  });

  test('reconfiguration drops an omitted header and envelope policy', async () => {
    const resolveHeaders = rs.fn(() => ({ authorization: 'Bearer stale' }));
    const { request, requestFactory } = createHarness('server', {
      authorization: 'Bearer incoming',
    });

    requestFactory.configure({
      request: request as unknown as typeof fetch,
      allowedHeaders: ['authorization'],
      resolveHeaders,
      requireEnvelope: true,
      identityBinding: {
        enabled: true,
        strict: false,
        protectedHeaders: ['x-user-id'],
        deriveHeaders: () => ({ 'x-user-id': 'stale-user' }),
      },
    });
    requestFactory.configure({
      request: request as unknown as typeof fetch,
    });

    const send = requestFactory.createRequest({
      path: REQUEST_PATH,
      method: 'GET',
      port: PORT,
    });
    await send();

    expect(resolveHeaders).not.toHaveBeenCalled();
    expect(request.mock.calls[0][1]?.headers).toEqual({
      accept: ACCEPT_HEADER,
    });
  });
});
