import { applyPlugins, type ProdServerOptions } from '@modern-js/prod-server';
import { createServerBase } from '@modern-js/server-core';
import { ultramodernServerPlugin } from '@modern-js/server-runtime-extensions/server-plugin';
import fs from 'fs';
import os from 'os';
import path from 'path';

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'modern-prod-apply-plugins-'));

describe('composed fork error responses', () => {
  test('returns safe BFF failure envelopes and maintenance Retry-After from prod error fallback', async () => {
    const tempDir = makeTempDir();

    let server: ReturnType<typeof createServerBase> | undefined;
    try {
      const options = {
        pwd: tempDir,
        serverConfigPath: path.join(tempDir, 'modern.server.js'),
        appContext: {
          apiDirectory: '',
          lambdaDirectory: '',
          appDirectory: tempDir,
        },
        config: {
          html: {},
          output: {},
          source: {},
          tools: {},
          server: {
            logger: false,
          },
          bff: {
            prefix: '/api',
          },
          dev: {},
          security: {},
        },
        serverConfig: {
          middlewares: [
            {
              name: 'throw-bff-error',
              path: '/api/*',
              handler: (c: any) => {
                if (c.req.path.includes('maintenance')) {
                  throw Object.assign(new Error('maintenance detail'), {
                    status: 503,
                    retryAfterSeconds: 90,
                  });
                }
                throw new Error('raw secret detail');
              },
            },
          ],
        },
      } as unknown as ProdServerOptions;

      options.plugins = [ultramodernServerPlugin()];
      server = createServerBase(options);
      await applyPlugins(server, options);
      await server.init();

      const failure = await server.request('/api/failure', {}, {});
      expect(failure.status).toBe(500);
      await expect(failure.json()).resolves.toEqual({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Server Error',
          status: 500,
        },
      });

      const maintenance = await server.request('/api/maintenance', {}, {});
      expect(maintenance.status).toBe(503);
      expect(maintenance.headers.get('Retry-After')).toBe('90');
      await expect(maintenance.json()).resolves.toEqual({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service Unavailable',
          status: 503,
        },
      });
    } finally {
      await server?.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('fork error response selection', () => {
  let directory: string;
  let server: ReturnType<typeof createServerBase> | undefined;

  beforeEach(() => {
    directory = makeTempDir();
  });
  afterEach(async () => {
    await server?.dispose();
    server = undefined;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const initialize = async (
    onError?: NonNullable<ProdServerOptions['serverConfig']>['onError'],
  ) => {
    const options: ProdServerOptions = {
      pwd: directory,
      serverConfigPath: path.join(directory, 'modern.server.js'),
      appContext: {
        appDirectory: directory,
        apiDirectory: '',
        lambdaDirectory: '',
      },
      config: {
        html: {},
        output: {},
        source: {},
        tools: {},
        server: { logger: false },
        bff: { prefix: ['/rpc', '/service'] },
        dev: {},
        security: {},
      },
      plugins: [ultramodernServerPlugin()],
      serverConfig: {
        onError,
        middlewares: [
          {
            name: 'request-failure',
            order: 'pre',
            handler: () => {
              throw Object.assign(new Error('private maintenance detail'), {
                status: 503,
                retryAfterSeconds: 15,
              });
            },
          },
        ],
      },
    };
    server = createServerBase(options);
    await applyPlugins(server, options);
    await server.init();
    return server;
  };

  test('applies the owner envelope to every configured prefix and leaves HTML outside them', async () => {
    const instance = await initialize();
    for (const url of ['/rpc/failure', '/service/failure']) {
      const response = await instance.request(url, {}, {});
      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('15');
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service Unavailable',
          status: 503,
        },
      });
    }
    const page = await instance.request('/api/page', {}, {});
    expect(page.status).toBe(500);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).not.toContain('private maintenance detail');
  });

  test('preserves a user error response before applying the fork policy', async () => {
    const instance = await initialize(
      () => new Response('user unavailable', { status: 409 }),
    );
    const response = await instance.request('/rpc/failure', {}, {});
    expect(response.status).toBe(409);
    expect(await response.text()).toBe('user unavailable');
    expect(response.headers.get('Retry-After')).toBeNull();
  });

  test.each([
    'declines',
    'throws',
  ])('applies the fork policy when the user handler %s', async outcome => {
    const instance = await initialize(() => {
      if (outcome === 'throws') throw new Error('custom handler detail');
    });
    const response = await instance.request('/rpc/failure', {}, {});
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('15');
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service Unavailable',
        status: 503,
      },
    });
  });
});
