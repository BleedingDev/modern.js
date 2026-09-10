import {
  createDefaultPlugins,
  createServerBase,
  type ServerPlugin,
} from '@modern-js/server-core';
import { describe, expect, test } from '@rstest/core';
import { injectMfAssetCacheHeadersPlugin } from '../src/mfCache';
import { getDefaultAppContext, getDefaultConfig } from './helpers';

describe('injectMfAssetCacheHeadersPlugin', () => {
  const createServerWithStubAssets = async () => {
    const stubAssetsPlugin: ServerPlugin = {
      name: 'stub-static-assets',
      setup(api) {
        api.onPrepare(() => {
          const { middlewares } = api.getServerContext();
          middlewares.push({
            name: 'stub-static-assets',
            handler: async (c: any) => {
              const pathname = c.req.path as string;
              if (pathname === '/missing/remoteEntry.js') {
                return c.body('not found', 404);
              }
              if (pathname.endsWith('.json') || pathname.endsWith('.js')) {
                return c.body('asset-body', 200);
              }
              return c.json({ ok: true });
            },
          });
        });
      },
    };

    const server = createServerBase({
      config: getDefaultConfig(),
      pwd: process.cwd(),
      appContext: getDefaultAppContext(),
    });
    server.addPlugins([
      ...createDefaultPlugins({ logger: false }),
      injectMfAssetCacheHeadersPlugin(),
      stubAssetsPlugin,
    ]);
    await server.init();
    return server;
  };

  test('does not attach cache policies to error responses', async () => {
    const server = await createServerWithStubAssets();

    const response = await server.request('/missing/remoteEntry.js', {}, {});
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBeNull();
  });

  test('leaves non-MF assets untouched', async () => {
    const server = await createServerWithStubAssets();

    const response = await server.request('/static/js/app.js', {}, {});
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBeNull();
  });
});
