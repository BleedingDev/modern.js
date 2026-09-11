import { UNSAFE_ErrorResponseImpl as ErrorResponseImpl } from '@modern-js/runtime-utils/router';
import {
  __setTanstackRscPayloadDecoderForTests,
  createTanstackRscServerPayload,
  handleTanstackRscRedirect,
  loadTanstackRscRouteData,
} from '../../src/runtime/rsc/payloadRouter';
import { ReplayableStream } from '../../src/runtime/rsc/ReplayableStream';

async function readAll(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: number[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(...value);
  }

  return chunks;
}

function withNodeEnv<T>(value: string, callback: () => T): T {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return callback();
  } finally {
    process.env.NODE_ENV = original;
  }
}

describe('tanstack rsc runtime helpers', () => {
  afterEach(() => {
    __setTanstackRscPayloadDecoderForTests();
    rstest.restoreAllMocks();
  });

  test('ReplayableStream creates independent readers from one source', async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    const replayable = new ReplayableStream(source);

    await expect(readAll(replayable.createReplayStream())).resolves.toEqual([
      1, 2, 3,
    ]);
    await expect(readAll(replayable.createReplayStream())).resolves.toEqual([
      1, 2, 3,
    ]);
  });

  test('creates TanStack RSC server payload and omits client-loader data during RSC navigation', () => {
    const payload = createTanstackRscServerPayload(
      {
        state: {
          location: { href: '/products' },
          matches: [
            {
              loaderData: { shell: true },
              params: {},
              pathname: '/',
              pathnameBase: '/',
              route: {
                id: '__root__',
                options: {
                  staticData: {
                    modernRouteHasLoader: true,
                    modernRouteId: 'root',
                  },
                },
              },
              routeId: '__root__',
            },
            {
              loaderData: { product: 1 },
              params: {},
              pathname: '/products',
              pathnameBase: '/products',
              route: {
                id: '/products',
                parentRoute: { id: '__root__' },
                options: {
                  path: 'products',
                  staticData: {
                    modernRouteHandle: { section: 'shop' },
                    modernRouteHasClientLoader: true,
                    modernRouteHasLoader: true,
                    modernRouteId: 'products',
                  },
                },
              },
              routeId: '/products',
            },
          ],
        },
      },
      { omitClientLoaderData: true },
    );

    expect(payload).toMatchObject({
      type: 'render',
      loaderData: {
        __root__: { shell: true },
      },
      routes: [
        {
          hasClientLoader: false,
          hasLoader: true,
          id: '__root__',
        },
        {
          handle: { section: 'shop' },
          hasClientLoader: true,
          hasLoader: true,
          id: '/products',
          parentId: '__root__',
          path: 'products',
        },
      ],
    });
    expect(
      (payload.loaderData as Record<string, unknown>)['/products'],
    ).toBeUndefined();
  });

  test('redacts production TanStack RSC server payload errors (Error, RouteErrorResponse, and plain-object)', () => {
    const routeError = new ErrorResponseImpl(
      500,
      'secret status text',
      'route secret',
      true,
    );
    const serverError = new Error('server secret');
    serverError.stack = 'stack secret';

    const payload = withNodeEnv('production', () =>
      createTanstackRscServerPayload({
        state: {
          location: { href: '/products' },
          matches: [
            {
              error: serverError,
              params: {},
              pathname: '/',
              pathnameBase: '/',
              route: { id: '__root__' },
              routeId: '__root__',
            },
            {
              error: routeError,
              params: {},
              pathname: '/products',
              pathnameBase: '/products',
              route: {
                id: '/products',
                parentRoute: { id: '__root__' },
                options: { path: 'products' },
              },
              routeId: '/products',
            },
            {
              error: { message: 'plain secret', token: 'token secret' },
              params: {},
              pathname: '/plain',
              pathnameBase: '/plain',
              route: { id: '/plain', parentRoute: { id: '__root__' } },
              routeId: '/plain',
            },
          ],
        },
      }),
    );

    expect(payload.errors).toMatchObject({
      __root__: {
        message: 'Unexpected Server Error',
        stack: undefined,
        __type: 'Error',
      },
      '/products': {
        status: 500,
        statusText: 'Internal Server Error',
        data: 'Unexpected Server Error',
        __type: 'RouteErrorResponse',
      },
      '/plain': {
        message: 'Unexpected Server Error',
        stack: undefined,
        __type: 'Error',
      },
    });
    expect(JSON.stringify(payload.errors)).not.toContain('server secret');
    expect(JSON.stringify(payload.errors)).not.toContain('route secret');
    expect(JSON.stringify(payload.errors)).not.toContain('secret status text');
    expect(JSON.stringify(payload.errors)).not.toContain('stack secret');
    expect(JSON.stringify(payload.errors)).not.toContain('plain secret');
    expect(JSON.stringify(payload.errors)).not.toContain('token secret');
  });

  test('preserves RSC redirect response status and headers in TanStack redirects', async () => {
    const scenarios = [
      { location: '/base', name: 'exact basename', redirect: '/' },
      {
        location: '/base/login?from=%2Fbase',
        name: 'leading basename',
        redirect: '/login?from=%2Fbase',
      },
      {
        location: '/shop/base/login',
        name: 'mid-path basename',
        redirect: '/shop/base/login',
      },
    ] as const;

    for (const scenario of scenarios) {
      const response = handleTanstackRscRedirect(
        new Headers({
          Location: scenario.location,
          'X-Trace': scenario.name,
        }),
        '/base',
        307,
      );

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBeNull();
      expect(response.headers.get('X-Modernjs-BaseUrl')).toBe('/base');
      expect(response.headers.get('X-Modernjs-Redirect')).toBe(
        scenario.redirect,
      );
      expect(response.headers.get('X-Trace')).toBe(scenario.name);
    }

    rstest.stubGlobal(
      'fetch',
      rstest.fn(() =>
        Promise.resolve(
          new Response(null, {
            headers: {
              'X-Modernjs-Redirect': '/login',
              'X-Trace': 'preserved',
            },
            status: 308,
          }),
        ),
      ),
    );

    const thrown = (await loadTanstackRscRouteData({
      loadClientData: async () => ({ fallback: true }),
      request: new Request('http://localhost/products'),
      routeId: '/products',
    }).then(
      () => {
        throw new Error('expected redirect');
      },
      err => err,
    )) as Response & {
      options?: { statusCode?: number; to?: string };
    };

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(308);
    expect(thrown.headers.get('X-Trace')).toBe('preserved');
    expect(thrown.options?.statusCode).toBe(308);
    expect(thrown.options?.to).toBe('/login');
  });

  test('separates RSC payload cache entries by URL and request method', async () => {
    const payloads = [
      {
        type: 'render',
        actionData: null,
        errors: null,
        loaderData: { '/method': { method: 'GET' } },
        location: { href: '/method' },
        routes: [{ id: '/method', hasLoader: true }],
      },
      {
        type: 'render',
        actionData: null,
        errors: null,
        loaderData: { '/method': { method: 'POST' } },
        location: { href: '/method' },
        routes: [{ id: '/method', hasLoader: true }],
      },
    ];
    let payloadIndex = 0;
    const fetchMock = rstest.fn(() =>
      Promise.resolve(new Response(JSON.stringify(payloads[payloadIndex++]))),
    );
    rstest.stubGlobal('fetch', fetchMock);
    __setTanstackRscPayloadDecoderForTests(async stream =>
      JSON.parse(await new Response(stream).text()),
    );

    const [getData, postData] = await Promise.all([
      loadTanstackRscRouteData({
        loadClientData: async () => ({ fallback: 'get' }),
        request: new Request('http://localhost/method', { method: 'GET' }),
        routeId: '/method',
      }),
      loadTanstackRscRouteData({
        loadClientData: async () => ({ fallback: 'post' }),
        request: new Request('http://localhost/method', { method: 'POST' }),
        routeId: '/method',
      }),
    ]);

    expect(getData).toEqual({ method: 'GET' });
    expect(postData).toEqual({ method: 'POST' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('separates RSC payload cache entries by forwarded request headers', async () => {
    const payloadByUser: Record<string, unknown> = {
      alice: {
        type: 'render',
        actionData: null,
        errors: null,
        loaderData: {
          '/profile': { user: 'alice' },
        },
        location: { href: '/profile' },
        routes: [{ id: '/profile', hasLoader: true }],
      },
      bob: {
        type: 'render',
        actionData: null,
        errors: null,
        loaderData: {
          '/profile': { user: 'bob' },
        },
        location: { href: '/profile' },
        routes: [{ id: '/profile', hasLoader: true }],
      },
    };
    const fetchMock = rstest.fn(
      (_url: string | URL | Request, init?: RequestInit) => {
        const user =
          init?.headers instanceof Headers ? init.headers.get('x-user') : null;
        return Promise.resolve(
          new Response(JSON.stringify(payloadByUser[user || ''])),
        );
      },
    );
    rstest.stubGlobal('fetch', fetchMock);
    __setTanstackRscPayloadDecoderForTests(async stream =>
      JSON.parse(await new Response(stream).text()),
    );

    const [aliceData, bobData] = await Promise.all([
      loadTanstackRscRouteData({
        loadClientData: async () => ({ fallback: 'alice' }),
        request: new Request('http://localhost/profile', {
          headers: { 'x-user': 'alice' },
        }),
        routeId: '/profile',
      }),
      loadTanstackRscRouteData({
        loadClientData: async () => ({ fallback: 'bob' }),
        request: new Request('http://localhost/profile', {
          headers: { 'x-user': 'bob' },
        }),
        routeId: '/profile',
      }),
    ]);

    expect(aliceData).toEqual({ user: 'alice' });
    expect(bobData).toEqual({ user: 'bob' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('rethrows matched route errors from the decoded payload', async () => {
    const routeError = new Error('route loader failed');
    const payload = {
      type: 'render',
      actionData: null,
      errors: { '/broken': routeError },
      loaderData: {},
      location: { href: '/broken' },
      routes: [{ id: '/broken', hasLoader: true }],
    };
    rstest.stubGlobal(
      'fetch',
      rstest.fn(() => Promise.resolve(new Response('payload'))),
    );
    __setTanstackRscPayloadDecoderForTests(async () => payload);

    await expect(
      loadTanstackRscRouteData({
        loadClientData: async () => ({ fallback: true }),
        request: new Request('http://localhost/broken'),
        routeId: '/broken',
      }),
    ).rejects.toBe(routeError);
  });

  test('returns undefined for a route id missing from the decoded payload', async () => {
    const loadClientData = rstest.fn(async () => ({ fallback: true }));
    const payload = {
      type: 'render',
      actionData: null,
      errors: null,
      loaderData: { '/known': { known: true } },
      location: { href: '/known' },
      routes: [{ id: '/known', hasLoader: true }],
    };
    rstest.stubGlobal(
      'fetch',
      rstest.fn(() => Promise.resolve(new Response('payload'))),
    );
    __setTanstackRscPayloadDecoderForTests(async () => payload);

    await expect(
      loadTanstackRscRouteData({
        loadClientData,
        request: new Request('http://localhost/missing'),
        routeId: '/missing',
      }),
    ).resolves.toBeUndefined();
    expect(loadClientData).not.toHaveBeenCalled();
  });

  test('uses client loader data without requesting an RSC payload for client-loader routes', async () => {
    const fetchMock = rstest.fn();
    const loadClientData = rstest.fn(async () => ({ client: true }));
    rstest.stubGlobal('fetch', fetchMock);

    await expect(
      loadTanstackRscRouteData({
        hasClientLoader: true,
        loadClientData,
        request: new Request('http://localhost/client'),
        routeId: '/client',
      }),
    ).resolves.toEqual({ client: true });

    expect(loadClientData).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rethrows serialized notFound payload errors for the matched route', async () => {
    const payload = {
      type: 'render',
      actionData: null,
      errors: {
        '/missing': {
          isNotFound: true,
        },
      },
      loaderData: {},
      location: { href: '/missing' },
      routes: [{ id: '/missing', hasLoader: true }],
    };
    rstest.stubGlobal(
      'fetch',
      rstest.fn(() => Promise.resolve(new Response('payload'))),
    );
    __setTanstackRscPayloadDecoderForTests(async () => payload);

    await expect(
      loadTanstackRscRouteData({
        loadClientData: async () => ({ fallback: true }),
        request: new Request('http://localhost/missing'),
        routeId: '/missing',
      }),
    ).rejects.toMatchObject({
      isNotFound: true,
      routeId: '/missing',
    });
  });
});
