import { RenderLevel } from '../../../../src/core/constants';
import { buildShellAfterTemplate } from '../../../../src/core/server/stream/afterTemplate';

describe('native stream data and scripts', () => {
  it('should include nonce attributes in injected async scripts when nonce is present', async () => {
    const html = await buildShellAfterTemplate('<!--<?- chunksMap.js ?>-->', {
      entryName: 'main',
      renderLevel: RenderLevel.SERVER_RENDER,
      request: new Request('http://localhost/'),
      runtimeContext: {
        routeManifest: {
          routeAssets: {
            'async-main': {
              assets: ['/assets/main.js'],
            },
          },
        },
        initialData: {},
        __i18nData__: {},
        ssrContext: {
          request: {
            params: {},
            query: {},
            pathname: '/',
            host: 'localhost',
            url: 'http://localhost/',
            headers: {},
          },
          reporter: { sessionId: 'session-1' },
        },
      } as any,
      ssrConfig: {} as any,
      config: {
        nonce: 'nonce-value',
      } as any,
    });

    expect(html).toContain(
      '<script src="/assets/main.js" nonce="nonce-value"></script>',
    );
  });
});
