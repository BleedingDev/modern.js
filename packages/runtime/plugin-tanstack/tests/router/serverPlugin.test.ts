import type { TInternalRuntimeContext } from '@modern-js/runtime/context';
import { routerProviderRegistryHooks } from '@modern-js/runtime/context';
import { type AnyRouter, RouterProvider } from '@tanstack/react-router';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  getRouterRuntimeState,
  getRouterServerSnapshot,
} from '../../src/runtime/lifecycle';
import { tanstackRouterPlugin } from '../../src/runtime/plugin.node';
import type { TanstackRouterPluginAPI } from '../../src/runtime/pluginShared';
import type { RouterConfig } from '../../src/runtime/types';

type BeforeRenderListener = Parameters<
  TanstackRouterPluginAPI['onBeforeRender']
>[0];

function collectBeforeRender(
  createRoutes: NonNullable<RouterConfig['createRoutes']>,
) {
  let listener: BeforeRenderListener | undefined;
  tanstackRouterPlugin({ createRoutes }).setup?.({
    getRuntimeConfig: () => ({}),
    getHooks: () => routerProviderRegistryHooks,
    onBeforeRender: nextListener => {
      listener = nextListener;
    },
    wrapRoot: () => {},
  });

  if (!listener) {
    throw new Error('Expected the TanStack server plugin to register a hook');
  }
  return listener;
}

function createServerContext(pathname: string) {
  const status = rstest.fn();
  const context = {
    ssrContext: {
      baseUrl: '/',
      loaderContext: {},
      mode: 'string',
      request: {
        raw: new Request(`http://localhost${pathname}`),
      },
      response: { status },
    },
  } as unknown as TInternalRuntimeContext;

  return { context, status };
}

describe('tanstack server plugin router results', () => {
  afterEach(() => {
    rstest.restoreAllMocks();
  });

  test.each([
    '/cs/login',
    '/en/login',
  ])('renders native link active attributes during SSR at %s', async pathname => {
    const { context } = createServerContext(pathname);
    const beforeRender = collectBeforeRender(() => [
      {
        id: 'login',
        path: '/:lang/login',
        Component: () => {
          const Link = context.router?.Link;
          if (!Link) {
            throw new Error('SSR router did not provide its native Link');
          }
          return createElement(Link, { to: '/cs' }, 'Home');
        },
      },
    ]);
    await beforeRender(context, value => value);

    expect(context.router?.Link).toBeTypeOf('function');
    const html = renderToString(
      createElement(RouterProvider, {
        router: getRouterRuntimeState(context)?.instance as AnyRouter,
      }),
    );
    expect(html).toContain('href="/cs"');
    if (pathname === '/cs/login') {
      expect(html).toContain('data-status="active"');
      expect(html).toContain('aria-current="page"');
    } else {
      expect(html).not.toContain('data-status="active"');
      expect(html).not.toContain('aria-current="page"');
    }
  });

  test('uses the router render result as the HTTP and hydration status', async () => {
    const beforeRender = collectBeforeRender(() => [
      {
        id: 'root',
        path: '/',
        Component: () => null,
        children: [
          {
            id: 'target',
            path: 'target',
            Component: () => null,
          },
        ],
      },
    ]);
    const { context, status } = createServerContext('/target');

    await beforeRender(context, value => value);

    expect(status).toHaveBeenCalledWith(200);
    expect(getRouterServerSnapshot(context)).toMatchObject({
      framework: 'tanstack',
      statusCode: 200,
    });
  });

  test('interrupts SSR with the router redirect response', async () => {
    const beforeRender = collectBeforeRender(() => [
      {
        id: 'root',
        path: '/',
        Component: () => null,
        children: [
          {
            id: 'redirect',
            path: 'redirect',
            loader: () =>
              new Response(null, {
                status: 307,
                headers: { Location: '/target' },
              }),
            Component: () => null,
          },
          {
            id: 'target',
            path: 'target',
            Component: () => null,
          },
        ],
      },
    ]);
    const { context, status } = createServerContext('/redirect');
    const interrupt = rstest.fn((value: unknown) => value);

    const response = await beforeRender(context, interrupt);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(307);
    expect((response as Response).headers.get('Location')).toBe('/target');
    expect(interrupt).toHaveBeenCalledWith(response);
    expect(status).not.toHaveBeenCalled();
  });
});
