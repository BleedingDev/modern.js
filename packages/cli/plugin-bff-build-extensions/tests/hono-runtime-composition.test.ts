import 'reflect-metadata';
import os from 'node:os';
import path from 'node:path';
import type { AppTools } from '@modern-js/app-tools';
import type { APIHandlerInfo } from '@modern-js/bff-core';
import {
  type Plugin as BasePlugin,
  createPluginManager,
} from '@modern-js/plugin';
import { createContext, initPluginAPI } from '@modern-js/plugin/cli';
import { server } from '@modern-js/plugin/server';
import nativeServer, {
  type BffServerPluginOptions,
} from '@modern-js/plugin-bff/server-plugin';
import {
  compatPlugin,
  Hono,
  handleSetupResult,
  type ServerConfig,
  type ServerPlugin,
} from '@modern-js/server-core';
import { buildOperationContractMap } from '@modern-js/server-runtime-extensions/bff-policy/node';
import { fs } from '@modern-js/utils';
import {
  assertParityResult,
  createAdapterParityScenarios,
  createParityApiHandlerInfos,
  createParityBffConfig,
  type ParityHttpResponse,
} from '../../plugin-bff-extensions/tests/helpers/bff-policy-parity/parity';
import { bffPlugin } from '../src';

let appDirectory: string;
let options: BffServerPluginOptions;

beforeAll(async () => {
  appDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'hono-runtime-composition-'),
  );
  const apiDirectory = path.join(appDirectory, 'api');
  await fs.ensureDir(apiDirectory);
  await fs.outputJSON(path.join(appDirectory, 'package.json'), {
    name: 'hono-composition-producer',
    version: '1.0.0',
    dependencies: { '@modern-js/plugin-bff-extensions': '3.8.3' },
  });
  const lowerPackage = path.resolve(__dirname, '../../plugin-bff-extensions');
  const installedLower = path.join(
    appDirectory,
    'node_modules/@modern-js/plugin-bff-extensions',
  );
  await fs.ensureDir(path.dirname(installedLower));
  await fs.symlink(
    lowerPackage,
    installedLower,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const manager = createPluginManager();
  manager.addPlugins([bffPlugin()]);
  const plugins = manager.getPlugins();
  const config = {
    bff: { runtimeFramework: 'hono' },
    source: {},
    resolve: {},
    output: { distPath: { root: 'dist' } },
    server: {},
  };
  const context = await createContext<AppTools>({
    appContext: {
      appDirectory,
      apiDirectory,
      lambdaDirectory: path.join(apiDirectory, 'lambda'),
      sharedDirectory: path.join(appDirectory, 'shared'),
      distDirectory: appDirectory,
      moduleType: 'commonjs',
      plugins,
    } as never,
    config: config as never,
    normalizedConfig: config as never,
  });
  const api = initPluginAPI<AppTools>({ context, pluginManager: manager });
  for (const plugin of plugins) await plugin.setup?.(api);
  const registered = await api
    .getHooks()
    ._internalServerPlugins.call({ plugins: [] });
  const descriptors = registered.plugins.filter(
    item => item.name === '@modern-js/plugin-bff/server-plugin',
  );
  expect(descriptors).toHaveLength(1);
  options = JSON.parse(JSON.stringify(descriptors[0]!.options));
  expect(options.honoRouteBinder).toBe(
    '@modern-js/plugin-bff-extensions/hono/node',
  );
});

afterAll(async () => {
  if (appDirectory) await fs.remove(appDirectory);
});

async function createApp(
  handlerInfos: APIHandlerInfo[] | undefined,
  bff: ServerConfig['bff'],
  onError?: ServerConfig['onError'],
) {
  const provider: ServerPlugin = {
    name: 'provide-test-handlers-after-native-discovery',
    setup(api) {
      api.prepareApiServer((async (input, next) => {
        api.updateServerContext({
          ...api.getServerContext(),
          apiHandlerInfos: handlerInfos,
        });
        return next(input);
      }) as Parameters<typeof api.prepareApiServer>[0]);
    },
  };
  const { serverContext } = await server.run({
    plugins: [compatPlugin(), nativeServer(options), provider] as BasePlugin[],
    options: {
      appContext: {
        appDirectory,
        distDirectory: appDirectory,
        apiDirectory: path.join(appDirectory, 'api'),
        bffRuntimeFramework: 'hono',
        middlewares: [],
      },
      pwd: appDirectory,
    },
    config: {
      html: {},
      output: {},
      source: {},
      tools: {},
      server: {},
      bff,
      dev: {},
      security: {},
      onError,
    },
    handleSetupResult,
    Hono,
  });
  await serverContext.pluginAPI!.getHooks().onPrepare.call();
  const routes = serverContext
    .pluginAPI!.getServerContext()
    .middlewares.filter(item => item.name === 'hono-bff-api');
  const app = new Hono();
  for (const route of routes) {
    const handlers = Array.isArray(route.handler)
      ? route.handler
      : [route.handler];
    app.on(route.method ?? 'all', route.path!, ...handlers);
  }
  return { app, routes };
}

async function toParityHttpResponse(
  response: Response,
): Promise<ParityHttpResponse> {
  const type = response.headers.get('content-type') || '';
  const text = await response.text();
  let body: unknown;
  if (type.includes('json')) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  return { status: response.status, type, body, text };
}

describe('Hono parity through CLI options and the native server plugin', () => {
  for (const scenario of createAdapterParityScenarios()) {
    test(scenario.name, async () => {
      const bff = createParityBffConfig();
      const { app } = await createApp(
        createParityApiHandlerInfos(),
        scenario.policy ? bff : {},
      );
      const { method, path: requestPath, headers, body } = scenario.request;
      const response = await app.request(requestPath, {
        method: method.toUpperCase(),
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      assertParityResult(scenario, await toParityHttpResponse(response));
    });
  }

  test('accepts policy-enabled startup before handlers are discovered', async () => {
    const { routes } = await createApp(undefined, {
      crossProjectPolicy: { enabled: true },
      isCrossProjectServer: true,
    });
    expect(routes).toEqual([]);
  });

  test('returns safe failure when Retry-After value is invalid', async () => {
    const maintenanceError = Object.assign(new Error('maintenance detail'), {
      status: 503,
      retryAfter: '120\r\nX-Injected: 1',
    });
    const { app, routes } = await createApp(
      [
        {
          routePath: '/api/maintenance',
          httpMethod: 'GET',
          handler: async () => {
            throw maintenanceError;
          },
        },
      ] as APIHandlerInfo[],
      {},
      () => {},
    );
    expect(routes).toHaveLength(1);
    const response = await app.request('/api/maintenance');
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service Unavailable',
        status: 503,
      },
    });
  });

  test('binds cross-project policy to the Hono route that actually matched', async () => {
    const requestId = 'crm.producer-a';
    const infos = [
      {
        handler: () => ({ id: 'foo' }),
        routePath: '/api/foo',
        httpMethod: 'GET',
      },
      {
        handler: () => ({ id: 'bar' }),
        routePath: '/api/bar',
        httpMethod: 'POST',
      },
    ] as APIHandlerInfo[];
    const forgedContract = buildOperationContractMap({
      handlers: infos,
      requestId,
    })['POST:/api/bar']!;
    const headers = {
      'x-modernjs-bff-envelope': JSON.stringify({ requestId }),
      'x-operation-id': forgedContract.operationId,
      'x-modernjs-bff-operation-context': JSON.stringify({
        requestId,
        operationId: forgedContract.operationId,
        method: forgedContract.method,
        routePath: forgedContract.routePath,
        schemaHash: forgedContract.schemaHash,
        operationVersion: forgedContract.operationVersion,
      }),
    };
    const { app, routes } = await createApp(infos, {
      requestId,
      crossProjectPolicy: { enabled: true },
    });
    expect(routes.map(route => route.name)).toEqual([
      'hono-bff-api',
      'hono-bff-api',
    ]);
    expect(routes.find(route => route.path === '/api/foo')).toBeDefined();
    const response = await app.request('/api/foo', { headers });
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'operation_context_mismatch',
    });
  });
});
