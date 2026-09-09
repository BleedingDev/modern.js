import type {
  MiddlewareHandler,
  ServerPluginAPI,
} from '@modern-js/server-core';
import { createHonoRouteBinder } from '../src/hono/node';

const createApi = (bff = {}, onError?: () => Response): ServerPluginAPI =>
  ({
    getServerContext: () => ({}),
    getServerConfig: () => ({ bff, onError }),
  }) as unknown as ServerPluginAPI;

const first = (handler: MiddlewareHandler | MiddlewareHandler[]) =>
  Array.isArray(handler) ? handler[0]! : handler;

test('composes the current policy and exact route before dispatch', async () => {
  const bind = createHonoRouteBinder(
    createApi({
      requestId: 'crm.producer-a',
      crossProjectPolicy: { enabled: true },
    }),
    [{ name: 'customer', routePath: '/api/customer', httpMethod: 'GET' }],
  );
  const handler = rstest.fn(async () => new Response('private'));
  const result = await first(bind({ handler, routePath: '/api/customer' }))(
    { req: { method: 'GET', header: () => ({}) } } as never,
    async () => {},
  );
  expect((result as Response).status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});

test('retains configured error responses when policy is disabled', async () => {
  const response = new Response('configured', { status: 418 });
  const onError = rstest.fn(() => response);
  const bind = createHonoRouteBinder(createApi({}, onError), []);
  const result = await first(
    bind({
      handler: async () => {
        throw new Error('failure');
      },
      routePath: '/api/customer',
    }),
  )({} as never, async () => {});
  expect(result).toBe(response);
  expect(onError).toHaveBeenCalledTimes(1);
});

test('allows policy-enabled preparation before handlers are discovered', () => {
  expect(
    typeof createHonoRouteBinder(
      createApi({
        crossProjectPolicy: { enabled: true },
        isCrossProjectServer: true,
      }),
      [],
    ),
  ).toBe('function');
});
