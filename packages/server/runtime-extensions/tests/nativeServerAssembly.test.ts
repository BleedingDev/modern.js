import { applyPlugins, type ProdServerOptions } from '@modern-js/prod-server';
import {
  createDefaultPlugins,
  createServerBase,
  type ServerPlugin,
} from '@modern-js/server-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ultramodernServerPlugin } from '../src/serverPlugin';

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'modern-prod-apply-plugins-'));

describe('applyPlugins fork plugin assembly', () => {
  test('bare server-core exposes no runtime status route for telemetry config', async () => {
    const server = createServerBase({
      config: {
        html: {},
        output: {},
        source: {},
        tools: {},
        bff: {},
        dev: {},
        security: {},
        server: {
          telemetry: { enabled: true, canary: { enabled: true } },
        },
      },
      pwd: process.cwd(),
      appContext: { apiDirectory: '', lambdaDirectory: '' },
    } as any);
    server.addPlugins([...createDefaultPlugins({ logger: false })]);
    await server.init();

    const response = await server.request('/_modern/runtime/status', {}, {});
    expect(response.status).toBe(404);
  });

  test('registers the telemetry plugin from @modern-js/server-runtime-extensions', async () => {
    const tempDir = makeTempDir();
    const snapshotPath = path.join(tempDir, '.modern/contract-gates.json');

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
            telemetry: {
              enabled: true,
              health: {
                enabled: true,
                minConsecutiveFailedEvaluations: 1,
                snapshotObservation: {
                  enabled: true,
                  gateSnapshotPath: snapshotPath,
                  pollIntervalMs: 60_000,
                  runtimeFallbackSignal: {
                    enabled: true,
                    auth: {
                      expectedValue: 'assembly-signal-token',
                    },
                  },
                },
              },
            },
          },
          bff: {},
          dev: {},
          security: {},
        },
      } as unknown as ProdServerOptions;

      options.plugins = [ultramodernServerPlugin()];
      server = createServerBase(options);
      await applyPlugins(server, options);
      await server.init();

      // Status detail requires the configured token.
      const unauthorizedStatus = await server.request(
        '/_modern/runtime/status',
        {},
        {},
      );
      expect(unauthorizedStatus.status).toBe(401);

      const statusResponse = await server.request(
        '/_modern/runtime/status',
        {
          method: 'GET',
          headers: new Headers({
            'x-modernjs-runtime-signal-token': 'assembly-signal-token',
          }),
        },
        {},
      );
      expect(statusResponse.status).toBe(200);
      const status = (await statusResponse.json()) as Record<string, any>;
      expect(status.ok).toBe(true);
      expect(status.health.enabled).toBe(true);

      // The signal endpoint requires the token as well.
      const unauthorizedSignal = await server.request(
        '/_modern/contract-gates/runtime-fallback',
        {
          method: 'POST',
          headers: new Headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            reason: 'remote_load_failed',
            phase: 'load',
            appName: 'dashboard',
            entry: 'https://remote.example.com/remoteEntry.js',
          }),
        },
        {},
      );
      expect(unauthorizedSignal.status).toBe(401);
      expect(fs.existsSync(snapshotPath)).toBe(false);

      const signalResponse = await server.request(
        '/_modern/contract-gates/runtime-fallback',
        {
          method: 'POST',
          headers: new Headers({
            'content-type': 'application/json',
            'x-modernjs-runtime-signal-token': 'assembly-signal-token',
          }),
          body: JSON.stringify({
            reason: 'remote_load_failed',
            phase: 'load',
            appName: 'dashboard',
            entry: 'https://remote.example.com/remoteEntry.js',
          }),
        },
        {},
      );
      expect(signalResponse.status).toBe(202);
      expect(fs.existsSync(snapshotPath)).toBe(true);
    } finally {
      await server?.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('registers injectModuleFederationCssPlugin after injectResourcePlugin in the real assembly', async () => {
    const tempDir = makeTempDir();

    let server: ReturnType<typeof createServerBase> | undefined;
    try {
      // Host MF manifest fixture: makes injectModuleFederationCssPlugin
      // active for this dist directory (no remotes -> no network access).
      fs.writeFileSync(
        path.join(tempDir, 'mf-manifest.json'),
        JSON.stringify({ remotes: [] }),
      );

      let observedManifest: Record<string, unknown> | undefined;

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
          bff: {},
          dev: {},
          security: {},
        },
        serverConfig: {
          middlewares: [
            {
              name: 'capture-server-manifest',
              // run after every default middleware (including
              // inject-server-manifest and inject-module-federation-css)
              order: 'post' as const,
              handler: async (c: any) => {
                observedManifest = c.get('serverManifest') as Record<
                  string,
                  unknown
                >;
                return c.json({ ok: true });
              },
            },
          ],
        },
      } as unknown as ProdServerOptions;

      options.plugins = [ultramodernServerPlugin()];
      server = createServerBase(options);
      await applyPlugins(server, options);
      await server.init();

      const response = await server.request('/', {}, {});
      expect(response.status).toBe(200);

      // The real injectResourcePlugin middleware ran first and set the
      // request-scoped manifest...
      expect(observedManifest).toBeTruthy();
      // ...and injectModuleFederationCssPlugin, registered after it in
      // applyPlugins, enriched that manifest. If the registration order
      // regressed, the manifest would not exist yet at enrichment time and
      // this property would be undefined.
      expect(observedManifest!.moduleFederationCssAssets).toBeDefined();
    } finally {
      await server?.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('applies the MF asset cache-header policy in the real assembly', async () => {
    const tempDir = makeTempDir();

    let server: ReturnType<typeof createServerBase> | undefined;
    try {
      // Host MF manifest declaring a remoteEntry served by the static
      // middleware from this dist directory.
      fs.mkdirSync(path.join(tempDir, 'static'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'mf-manifest.json'),
        JSON.stringify({
          metaData: {
            remoteEntry: {
              path: 'static',
              name: 'remoteEntry.js',
            },
          },
          remotes: [],
        }),
      );
      fs.writeFileSync(
        path.join(tempDir, 'static', 'remoteEntry.js'),
        'var remoteEntry = 1;',
      );

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
          bff: {},
          dev: {},
          security: {},
        },
      } as unknown as ProdServerOptions;

      options.plugins = [ultramodernServerPlugin()];
      server = createServerBase(options);
      await applyPlugins(server, options);
      await server.init();

      const manifestResponse = await server.request(
        '/mf-manifest.json',
        {},
        {},
      );
      expect(manifestResponse.status).toBe(200);
      expect(manifestResponse.headers.get('cache-control')).toBe(
        'no-cache, no-store, must-revalidate',
      );
      expect(manifestResponse.headers.get('pragma')).toBe('no-cache');

      const remoteEntryResponse = await server.request(
        '/static/remoteEntry.js',
        {},
        {},
      );
      expect(remoteEntryResponse.status).toBe(200);
      expect(remoteEntryResponse.headers.get('cache-control')).toBe(
        'public, max-age=0, must-revalidate',
      );

      const pinnedRemoteEntryResponse = await server.request(
        '/static/remoteEntry.js?mfv=remote-v1',
        {},
        {},
      );
      expect(pinnedRemoteEntryResponse.status).toBe(200);
      expect(pinnedRemoteEntryResponse.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable',
      );
    } finally {
      await server?.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('preserves user plugins on both sides of the composed policies', async () => {
    const tempDir = makeTempDir();
    const setupOrder: string[] = [];
    const requestOrder: string[] = [];
    const userPlugin = (name: string): ServerPlugin => ({
      name,
      setup(api) {
        setupOrder.push(name);
        api.onPrepare(() => {
          api.getServerContext().middlewares.push({
            name,
            order: 'pre',
            handler: async (_c, next) => {
              requestOrder.push(name);
              await next();
            },
          });
        });
      },
    });
    const options = {
      pwd: tempDir,
      appContext: {
        appDirectory: tempDir,
        apiDirectory: '',
        lambdaDirectory: '',
      },
      config: {
        html: {},
        output: {},
        source: {},
        tools: {},
        bff: {},
        dev: {},
        security: {},
        server: { logger: false, telemetry: { enabled: false } },
      },
      plugins: [
        userPlugin('user-before'),
        ultramodernServerPlugin(),
        userPlugin('user-after'),
      ],
      serverConfig: {
        middlewares: [
          {
            name: 'response',
            order: 'post',
            handler: (c: any) => c.text('composed response'),
          },
        ],
      },
    } as unknown as ProdServerOptions;
    const server = createServerBase(options);
    try {
      await applyPlugins(server, options);
      await server.init();
      const response = await server.request('/', {}, {});
      expect(await response.text()).toBe('composed response');
      expect(setupOrder).toEqual(['user-before', 'user-after']);
      expect(requestOrder).toEqual(['user-before', 'user-after']);
    } finally {
      await server.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
