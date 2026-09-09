import {
  type APIHandlerInfo,
  Api,
  HttpCode,
  HttpMethod,
  Redirect,
  SetHeaders,
} from '@modern-js/bff-core';
import { match } from '@modern-js/bff-runtime';
import { Hono } from '@modern-js/server-core';
import createHonoRoutes from '../src/utils/createHonoRoutes';

const nativeHandlerInfo = (
  routePath: string,
  handler: APIHandlerInfo['handler'],
  httpMethod = HttpMethod.Get,
): APIHandlerInfo => ({
  handler,
  httpMethod,
  name: 'nativeHandler',
  filename: 'native-handler.ts',
  routeName: routePath,
  routePath,
});

const createNativeApp = (handlerInfos: APIHandlerInfo[]) => {
  const app = new Hono();
  for (const route of createHonoRoutes(handlerInfos)) {
    const handlers = Array.isArray(route.handler)
      ? route.handler
      : [route.handler];
    app.on(route.method, route.path, ...handlers);
  }
  return app;
};

describe('native Hono contracts retained after adapter-kit retirement', () => {
  test('preserves route registration and middleware execution order', async () => {
    const calls: string[] = [];
    const first = () => {
      calls.push('handler');
      return { route: 'first' };
    };
    Reflect.defineMetadata(
      'middleware',
      [
        async (_context: unknown, next: () => Promise<void>) => {
          calls.push('before');
          await next();
          calls.push('after');
        },
      ],
      first,
    );
    const infos = [
      nativeHandlerInfo('/first', first),
      nativeHandlerInfo('/second', () => ({ route: 'second' })),
    ];
    expect(createHonoRoutes(infos).map(({ path }) => path)).toEqual([
      '/first',
      '/second',
    ]);
    const response = await createNativeApp(infos).request('/first');
    expect(await response.json()).toEqual({ route: 'first' });
    expect(calls).toEqual(['before', 'handler', 'after']);
  });

  test('honors native status, header and redirect operators', async () => {
    const redirectedHandler = rstest.fn();
    const app = createNativeApp([
      nativeHandlerInfo(
        '/created',
        Api(HttpCode(201), SetHeaders({ 'x-native': 'yes' }), () => ({
          created: true,
        })),
      ),
      nativeHandlerInfo(
        '/redirect',
        Api(Redirect('/target'), redirectedHandler),
      ),
    ]);
    const created = await app.request('/created');
    expect(created.status).toBe(201);
    expect(created.headers.get('x-native')).toBe('yes');
    expect(await created.json()).toEqual({ created: true });
    const redirected = await app.request('/redirect');
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get('location')).toBe('/target');
    expect(redirectedHandler).not.toHaveBeenCalled();
  });

  test('passes positional parameters in route declaration order', async () => {
    const handler = rstest.fn(() => ({ ok: true }));
    const app = createNativeApp([
      nativeHandlerInfo('/items/:id/:tab', handler),
    ]);
    const response = await app.request('/items/42/summary?sort=asc');
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      '42',
      'summary',
      expect.objectContaining({
        params: { id: '42', tab: 'summary' },
        query: { sort: 'asc' },
      }),
    );
  });

  test('preserves real schema-handler result envelopes and status', async () => {
    const handler = match(
      { request: { data: { message: String } }, response: { reply: String } },
      async ({ data }) => ({ reply: data.message }),
    );
    const app = createNativeApp([
      nativeHandlerInfo('/schema', handler, HttpMethod.Post),
    ]);
    const success = await app.request('/schema', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({
      type: 'HandleSuccess',
      value: { reply: 'hello' },
    });
    const invalid = await app.request('/schema', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(invalid.status).toBe(200);
    expect(await invalid.json()).toMatchObject({
      type: 'InputValidationError',
    });
  });
});
