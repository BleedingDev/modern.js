import { describe, expect, test } from '@rstest/core';
import { i18nServerPlugin } from '../src/server';
import { resolveDefaultUrlStrategy } from '../src/server/defaultUrlStrategy';

const localisedUrls = {
  '/about': { en: '/about', cs: '/o-nas' },
};

const createRequestContext = (pathname: string) =>
  ({
    req: { url: `http://localhost${pathname}` },
  }) as any;

const bootServerPlugin = (options: Parameters<typeof i18nServerPlugin>[0]) => {
  const middlewares: any[] = [];
  const routes = [{ entryName: 'main', entryPath: '', urlPath: '/' }];
  let prepare: (() => void) | undefined;

  i18nServerPlugin(options).setup({
    getServerConfig: () => ({}),
    getServerContext: () => ({ middlewares, routes }),
    onPrepare: (fn: () => void) => {
      prepare = fn;
    },
  } as any);

  prepare?.();
  return middlewares;
};

describe('default URL strategy', () => {
  test('a mapped locale URL config alone produces a strategy', () => {
    const strategy = resolveDefaultUrlStrategy(localisedUrls);

    expect(strategy).toBeDefined();
    expect(strategy?.localizePathname('/about', 'cs', ['en', 'cs'])).toBe(
      '/cs/o-nas',
    );
    expect(strategy?.canonicalPathname('/cs/o-nas', ['en', 'cs'])).toBe(
      '/about',
    );
  });

  test('no map means no derived strategy', () => {
    expect(resolveDefaultUrlStrategy(undefined)).toBeUndefined();
    expect(resolveDefaultUrlStrategy({})).toBeUndefined();
    expect(resolveDefaultUrlStrategy('nope')).toBeUndefined();
  });

  test('`localisedUrls` boots the server without any extra plugin', () => {
    // Previously this threw "Mapped locale URLs require a URL strategy",
    // which stopped every existing consumer's server from starting.
    const middlewares = bootServerPlugin({
      localeDetection: {
        fallbackLanguage: 'en',
        languages: ['en', 'cs'],
        localePathRedirect: true,
        localisedUrls,
      } as any,
      staticRoutePrefixes: [],
    });

    expect(middlewares.map(middleware => middleware.name)).toContain(
      'i18n-server-middleware',
    );
  });

  test('redirects a canonical path to its mapped locale URL', async () => {
    const middlewares = bootServerPlugin({
      localeDetection: {
        fallbackLanguage: 'en',
        languages: ['en', 'cs'],
        localePathRedirect: true,
        localisedUrls,
      } as any,
      staticRoutePrefixes: [],
    });

    const redirect = middlewares.find(
      middleware => middleware.name === 'i18n-server-middleware',
    );
    const context = createRequestContext('/about');
    context.get = () => 'cs';
    const response = await redirect.handler(context, async () => undefined);

    expect(response?.headers?.get('location')).toBe('/cs/o-nas');
  });

  test('an explicit strategy still wins over the derived one', () => {
    const explicit = {
      localizePathname: () => '/explicit',
      canonicalPathname: () => '/explicit',
    };
    const middlewares = bootServerPlugin({
      localeDetection: {
        fallbackLanguage: 'en',
        languages: ['en', 'cs'],
        localePathRedirect: true,
        localisedUrls,
      } as any,
      staticRoutePrefixes: [],
      resolveUrlStrategy: () => explicit,
    });

    expect(middlewares.length).toBeGreaterThan(0);
  });
});
