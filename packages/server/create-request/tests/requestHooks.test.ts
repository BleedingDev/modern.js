import { storage } from '@modern-js/runtime-utils/node';
import { createClient as createBrowserClient } from '../src/browser';
import { createClient as createServerClient } from '../src/node';
import { extractPathParamNames } from '../src/requestFactory';

describe('native request clients and optional hooks', () => {
  test('retains native path parameter extraction', () => {
    expect(extractPathParamNames('/items/:id/sub/:subId')).toEqual([
      'id',
      'subId',
    ]);
  });

  test('isolates configuration while retaining native named request fallback', async () => {
    const first = createServerClient();
    const second = createServerClient();
    const firstRequest = rs.fn(async () => new Response('first'));
    const secondRequest = rs.fn(async () => new Response('second'));
    first.configure({
      requestId: 'shared',
      request: firstRequest,
      setDomain: () => 'https://first.example',
    });
    second.configure({
      requestId: 'shared',
      request: secondRequest,
      setDomain: () => 'https://second.example',
    });
    const options = {
      path: '/api',
      method: 'GET',
      port: 8080,
      requestId: 'shared',
    };
    expect(await (await first.createRequest(options)()).text()).toBe('first');
    expect(await (await second.createRequest(options)()).text()).toBe('second');
    expect(firstRequest).toHaveBeenCalledTimes(1);
    expect(secondRequest).toHaveBeenCalledTimes(1);

    const fallback = rs.fn(async () => new Response('fallback'));
    const request = createServerClient().createRequest({
      ...options,
      fetch: fallback,
    });
    expect(await (await request()).text()).toBe('fallback');
    expect(fallback).toHaveBeenCalledWith('http://127.0.0.1:8080/api', {
      method: 'GET',
      body: undefined,
      headers: { accept: 'application/json,*/*;q=0.8' },
    });
  });

  test('exposes caller and native forwarded headers separately before normalized dispatch', async () => {
    const client = createServerClient();
    const order: string[] = [];
    const request = rs.fn(async () => new Response('ok'));
    client.configure({ request, allowedHeaders: ['authorization'] });
    const callerHeaders = { Authorization: 'caller', Accept: 'caller-accept' };
    const sender = client.createRequest({
      path: '/items/:id',
      method: 'GET',
      port: 8080,
      hooks: {
        onStart: context => {
          order.push('start');
          expect(context.configured).toBe(true);
          expect(context.target).toBe('server');
        },
        prepareHeaders: ({ headers, forwardedHeaders, allowedHeaders }) => {
          order.push('headers');
          expect(headers).toEqual(callerHeaders);
          expect(forwardedHeaders).toEqual({ authorization: 'incoming' });
          expect(allowedHeaders).toEqual(['authorization']);
          forwardedHeaders.authorization = 'resolved';
        },
        dispatch: ({ url, init, fetcher }) => {
          order.push('dispatch');
          expect(url).toBe('http://127.0.0.1:8080/items/widget?filter=new');
          expect(init).toEqual({
            method: 'GET',
            body: undefined,
            headers: {
              authorization: 'resolved',
              accept: 'application/json,*/*;q=0.8',
              'Content-Type': 'text/plain',
            },
          });
          return fetcher(url, init);
        },
      },
    });
    await storage.run(
      { headers: { Authorization: 'incoming', 'x-private': 'private' } },
      () =>
        sender({
          params: { id: 'widget' },
          query: { filter: 'new' },
          headers: callerHeaders,
          body: 'discard',
        }),
    );
    expect(order).toEqual(['start', 'headers', 'dispatch']);
    expect(callerHeaders).toEqual({
      Authorization: 'caller',
      Accept: 'caller-accept',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('applies the same neutral hooks to native upload construction', async () => {
    const client = createBrowserClient();
    const response = new Response('handled');
    const dispatch = rs.fn(({ url, init }) => {
      expect(url).toBe('https://uploads.example/files/widget');
      expect(init.method).toBe('POST');
      expect(init.body).toBeInstanceOf(FormData);
      expect(init.headers.accept).toBeUndefined();
      expect(init.headers['x-upload']).toBe('test');
      return Promise.resolve(response);
    });
    const upload = client.createUploader({
      path: '/files/:id',
      domain: 'https://uploads.example',
      hooks: {
        prepareHeaders: ({ headers }) => {
          headers['x-upload'] = 'test';
        },
        dispatch,
      },
    });
    expect(
      await upload({
        params: { id: 'widget' },
        files: { file: new File(['body'], 'widget.txt') },
      }),
    ).toBe(response);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test('retains synchronous server errors and asynchronous browser request errors', async () => {
    const failure = new Error('hook failed');
    const options = {
      path: '/api',
      method: 'GET',
      port: 8080,
      hooks: {
        onStart: () => {
          throw failure;
        },
      },
    };
    const server = createServerClient().createRequest(options);
    const browser = createBrowserClient().createRequest(options);
    expect(() => server()).toThrow(failure);
    await expect(browser()).rejects.toBe(failure);
    expect(() =>
      createBrowserClient().createUploader({
        path: '/upload',
        hooks: options.hooks,
      })(),
    ).toThrow(failure);
  });

  test('resolves interceptor before domain and preserves configuration after callback failure', async () => {
    const client = createServerClient();
    const original = rs.fn(async () => new Response('original'));
    client.configure({
      request: original,
      setDomain: () => 'https://original.example',
    });
    const order: string[] = [];
    const replacement = rs.fn(async () => new Response('replacement'));
    expect(() =>
      client.configure({
        interceptor: () => {
          order.push('interceptor');
          return replacement;
        },
        setDomain: () => {
          order.push('domain');
          throw new Error('domain failed');
        },
      }),
    ).toThrow('domain failed');
    const request = client.createRequest({
      path: '/api',
      method: 'GET',
      port: 8080,
    });
    expect(await (await request()).text()).toBe('original');
    expect(order).toEqual(['interceptor', 'domain']);
    expect(original).toHaveBeenCalledWith(
      'https://original.example/api',
      expect.any(Object),
    );
    expect(replacement).not.toHaveBeenCalled();
  });
});
