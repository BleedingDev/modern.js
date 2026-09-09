import { handleRequest } from '@modern-js/plugin-data-loader/runtime';
import {
  createServerBase,
  getLoaderCtx,
  type MiddlewareHandler,
  type ServerPlugin,
} from '@modern-js/server-core';
import type { NestedRoute } from '@modern-js/types';
import { injectLocalisedLoaderPlugin } from '../src/localisedLoaderPlugin';
import { getDefaultAppContext, getDefaultConfig } from './helpers';

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

const render: MiddlewareHandler = async context =>
  (await handleRequest({
    request: context.req.raw,
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
      loaderContext: getLoaderCtx(context),
      monitors: { timing() {} },
    } as Parameters<typeof handleRequest>[0]['context'],
  })) ?? context.notFound();

const fixtureRenderPlugin: ServerPlugin = {
  name: 'fixture-loader-render',
  setup(api) {
    api.onPrepare(() => {
      api.getServerContext().middlewares.push({
        name: 'render',
        handler: render,
      });
    });
  },
};

let server: ReturnType<typeof createServerBase>;

beforeAll(async () => {
  server = createServerBase({
    config: getDefaultConfig(),
    pwd: process.cwd(),
    appContext: getDefaultAppContext(),
  });
  // Register after the render plugin to exercise native middleware ordering.
  server.addPlugins([fixtureRenderPlugin, injectLocalisedLoaderPlugin()]);
  await server.init();
});

afterAll(async () => {
  await server.dispose();
});

async function load(path: string, routeId: string, method = 'GET') {
  const url = new URL(path, 'https://example.test');
  url.searchParams.set('__loader', routeId);
  return server.request(url.toString(), { method });
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
