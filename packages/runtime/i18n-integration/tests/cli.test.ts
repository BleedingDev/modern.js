import type { AppTools, CliPlugin } from '@modern-js/app-tools';
import { createAsyncHook, createPluginManager } from '@modern-js/plugin';
import {
  createContext,
  initAppContext,
  initPluginAPI,
} from '@modern-js/plugin/cli';
import {
  type I18nPluginOptions as NativeCliOptions,
  i18nPlugin as nativeI18nPlugin,
} from '@modern-js/plugin-i18n/cli';
import type { NestedRouteForCli } from '@modern-js/types';
import { describe, expect, test } from '@rstest/core';
import { ultramodernI18nIntegrationPlugin } from '../src/cli';
import type { IntegratedLocaleDetectionOptions } from '../src/options';

type I18nPluginOptions = NativeCliOptions & {
  localeDetection?: IntegratedLocaleDetectionOptions;
};

const createRoute = (
  path: string,
  children?: NestedRouteForCli[],
): NestedRouteForCli => ({
  id: path,
  path,
  type: 'nested',
  origin: 'file-system',
  routeType: children ? 'layout' : 'page',
  _component: `${path}.tsx`,
  children,
});

async function createCliHarness(options: I18nPluginOptions = {}) {
  const manager = createPluginManager();
  const emitted: unknown[][] = [];
  let routeCalls = 0;
  const routeHost: CliPlugin<AppTools> = {
    name: 'test-route-host',
    registryHooks: { modifyFileSystemRoutes: createAsyncHook<any>() },
    setup(api) {
      api.modifyFileSystemRoutes(args => {
        routeCalls++;
        return args;
      });
    },
  };
  const observer: CliPlugin<AppTools> = {
    name: 'test-descriptor-observer',
    pre: ['@modern-js/i18n-integration'],
    setup(api) {
      api._internalRuntimePlugins(args => {
        emitted.push(args.plugins);
        return args;
      });
    },
  };
  // Deliberately register the integration first; native manager must order it.
  manager.addPlugins([
    ultramodernI18nIntegrationPlugin(),
    nativeI18nPlugin(options),
    routeHost,
    observer,
  ]);
  const plugins = manager.getPlugins() as CliPlugin<AppTools>[];
  const context = await createContext<AppTools>({
    appContext: initAppContext({
      packageName: 'i18n-integration-test',
      configFile: false,
      command: 'build',
      appDirectory: process.cwd(),
      metaName: 'modern-js',
      plugins,
    }),
    config: {},
    normalizedConfig: {} as any,
  });
  const api = initPluginAPI<AppTools>({ context, pluginManager: manager });
  for (const plugin of plugins) {
    await plugin.setup?.(api);
  }
  return { api, plugins, emitted, routeCalls: () => routeCalls };
}

const setupModifyRoutes = async (
  localeDetection: I18nPluginOptions['localeDetection'],
) => {
  const { api } = await createCliHarness({ localeDetection });
  return api.getHooks().modifyFileSystemRoutes.call;
};

describe('combined i18n CLI route policy', () => {
  const generateLocalisedRoutes = async () => {
    const modifyRoutes = await setupModifyRoutes({
      localePathRedirect: true,
      languages: ['en', 'cs', 'de'],
      localisedUrls: {
        '/about': {
          en: '/about',
          cs: '/o-nas',
          de: '/ueber-uns',
        },
        '/products': {
          en: '/products',
          cs: '/produkty',
          de: '/produkte',
        },
        '/products/:slug': {
          en: '/products/:slug',
          cs: '/produkty/:slug',
          de: '/produkte/:slug',
        },
        '/docs': {
          en: '/docs',
          cs: '/dokumenty',
          de: '/dokumente',
        },
        '/docs/*': {
          en: '/docs/*',
          cs: '/dokumenty/*',
          de: '/dokumente/*',
        },
      },
    });
    const routes = [
      createRoute(':lang', [
        createRoute('about'),
        createRoute('products', [createRoute(':slug')]),
        createRoute('docs', [createRoute('*')]),
      ]),
    ];

    const result = await modifyRoutes({
      entrypoint: { entryName: 'main' },
      routes,
    });

    return result.routes;
  };

  test('creates deterministic localized aliases with canonical route identity', async () => {
    const localisedRoutes = await generateLocalisedRoutes();
    expect(await generateLocalisedRoutes()).toEqual(localisedRoutes);

    const [localeLayout] = localisedRoutes;
    expect(localeLayout.children?.map(route => route.path)).toEqual([
      'about',
      'o-nas',
      'ueber-uns',
      'products',
      'produkty',
      'produkte',
      'docs',
      'dokumenty',
      'dokumente',
    ]);
    expect(localeLayout.children?.slice(0, 3)).toMatchObject([
      {
        _component: 'about.tsx',
        modernCanonicalPath: '/about',
        path: 'about',
      },
      {
        _component: 'about.tsx',
        modernCanonicalPath: '/about',
        path: 'o-nas',
      },
      {
        _component: 'about.tsx',
        modernCanonicalPath: '/about',
        path: 'ueber-uns',
      },
    ]);
    for (const productRoute of localeLayout.children?.slice(3, 6) ?? []) {
      expect(productRoute).toMatchObject({
        _component: 'products.tsx',
        modernCanonicalPath: '/products',
      });
      expect(productRoute.children?.[0]).toMatchObject({
        _component: ':slug.tsx',
        modernCanonicalPath: '/products/:slug',
        path: ':slug',
      });
    }
  });
  test('queries descriptors before generation without recursive routes or duplicate emissions', async () => {
    const { api, plugins } = await createCliHarness({
      reactI18next: false,
      localeDetection: {
        languages: ['en', 'cs'],
        localePathRedirect: true,
        localisedUrls: { '/about': { en: '/about', cs: '/o-nas' } },
      },
    });
    expect(
      plugins.findIndex(plugin => plugin.name === '@modern-js/plugin-i18n'),
    ).toBeLessThan(
      plugins.findIndex(
        plugin => plugin.name === '@modern-js/i18n-integration',
      ),
    );
    const entrypoint = { entryName: 'main' } as any;
    const input = [createRoute(':lang', [createRoute('about')])];
    const routeResult = await api
      .getHooks()
      .modifyFileSystemRoutes.call({ entrypoint, routes: input });
    expect(routeResult.routes[0].children?.map(route => route.path)).toEqual([
      'about',
      'o-nas',
    ]);
    const generated = await api
      .getHooks()
      ._internalRuntimePlugins.call({ entrypoint, plugins: [] });
    expect(generated.plugins).toHaveLength(1);
    const server = await api
      .getHooks()
      ._internalServerPlugins.call({ plugins: [] });
    expect(server.plugins).toHaveLength(1);
    expect(server.plugins[0]).toMatchObject({
      name: '@modern-js/i18n-integration/server',
    });
  });

  test('selects each entry config and preserves custom runtime/server descriptors', async () => {
    const { api } = await createCliHarness({
      localeDetection: {
        languages: ['en', 'cs'],
        localePathRedirect: true,
        localisedUrls: { '/about': { en: '/about', cs: '/o-nas' } },
        localeDetectionByEntry: {
          admin: {
            localisedUrls: { '/about': { en: '/about', cs: '/sprava' } },
          },
        },
      },
    });
    for (const [entryName, alias] of [
      ['main', 'o-nas'],
      ['admin', 'sprava'],
    ]) {
      const result = await api.getHooks().modifyFileSystemRoutes.call({
        entrypoint: { entryName } as any,
        routes: [createRoute(':lang', [createRoute('about')])],
      });
      expect(result.routes[0].children?.map(route => route.path)).toEqual([
        'about',
        alias,
      ]);
    }
    const custom = await createCliHarness({
      customPlugin: {
        runtime: { name: 'customI18n', path: 'custom/runtime' },
        server: { name: 'custom/server' },
      },
    });
    const runtime = await custom.api.getHooks()._internalRuntimePlugins.call({
      entrypoint: { entryName: 'main' } as any,
      plugins: [],
    });
    expect(runtime.plugins[0]).toMatchObject({
      name: 'customI18n',
      path: 'custom/runtime',
    });
    expect(
      (await custom.api.getHooks()._internalServerPlugins.call({ plugins: [] }))
        .plugins[0].name,
    ).toBe('custom/server');
  });

  test('leaves route objects untouched without an enabled map', async () => {
    const modifyRoutes = await setupModifyRoutes({
      languages: ['en', 'cs'],
      localePathRedirect: true,
    });
    const routes = [createRoute(':lang', [createRoute('about')])];
    expect(
      (await modifyRoutes({ entrypoint: { entryName: 'main' } as any, routes }))
        .routes,
    ).toBe(routes);
  });
});
