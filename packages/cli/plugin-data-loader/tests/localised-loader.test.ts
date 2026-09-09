import type { NestedRoute } from '@modern-js/types';
import { handleRequest } from '../src/runtime';

const sourceRoutes: NestedRoute[] = [
  {
    type: 'nested',
    id: 'search',
    path: ':lang/search',
    loader: ({ params, request }) => ({
      language: params.lang,
      query: new URL(request.url).searchParams.get('q'),
    }),
  },
  {
    type: 'nested',
    id: 'resource',
    path: ':lang/resources/:id',
    loader: ({ params }) => Response.json(params),
    action: ({ params }) => Response.json({ action: params.id }),
  },
];
// Shape emitted by the localized route generator, retaining each source ID.
const routes = [
  ...sourceRoutes,
  ...sourceRoutes.map(route => ({
    ...route,
    id: `${route.id}-cs`,
    path: route.path
      ?.replace('search', 'hledat')
      .replace('resources', 'zdroje'),
    modernLocalisedRoute: { id: route.id },
  })),
];

async function load(path: string, routeId: string, method = 'GET') {
  const url = new URL(path, 'https://example.test');
  url.searchParams.set('__loader', routeId);
  return handleRequest({
    request: new Request(url, { method }),
    routes,
    serverRoutes: [
      {
        urlPath: '/base',
        entryName: 'main',
        entryPath: 'index.html',
        isSSR: true,
      },
    ],
    context: {
      reporter: {},
      loaderContext: new Map(),
      monitors: { timing() {} },
    } as Parameters<typeof handleRequest>[0]['context'],
  });
}

test('serves a canonical loader ID at its localized URL with basepath and deferred data', async () => {
  const response = await load('/base/cs/hledat?q=tractor', 'search');
  expect(response?.status).toBe(200);
  expect(response?.headers.get('content-type')).toContain(
    'text/modernjs-deferred',
  );
  expect(await response?.text()).toContain('"language":"cs","query":"tractor"');
});

test('preserves encoded parameters for localized loaders and actions', async () => {
  const response = await load('/base/cs/zdroje/a%2Fb', 'resource');
  expect(response?.status).toBe(200);
  expect(await response?.json()).toEqual({ lang: 'cs', id: 'a/b' });
  const action = await load('/base/cs/zdroje/a%2Fb', 'resource', 'POST');
  expect(action?.status).toBe(200);
  expect(await action?.json()).toEqual({ action: 'a/b' });
});

test('retains canonical routes and rejects loader IDs from another route', async () => {
  expect((await load('/base/en/resources/item', 'resource'))?.status).toBe(200);
  expect((await load('/base/cs/hledat', 'resource'))?.status).toBe(403);
  expect((await load('/base/cs/zdroje/item', 'search'))?.status).toBe(403);
  expect((await load('/base/cs/hledat', 'missing'))?.status).toBe(403);
});
