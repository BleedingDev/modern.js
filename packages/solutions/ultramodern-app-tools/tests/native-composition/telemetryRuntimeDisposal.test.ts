import { EventEmitter } from 'node:events';
import { applyPlugins, type ProdServerOptions } from '@modern-js/prod-server';
import { createServerBase, type ServerPlugin } from '@modern-js/server-core';
import {
  registerServerRuntimeDisposer,
  TelemetryRegistry,
} from '@modern-js/server-runtime-extensions';
import ultramodernServerPlugin from '@modern-js/server-runtime-extensions/server-plugin';
import {
  createDrainingHandle,
  ReloadManager,
} from '../../../../server/server/src/dev-tools/reloadManager';

const runtimes: ReturnType<typeof createServerBase>[] = [];

async function createRuntime(
  nodeServer: EventEmitter,
  message: string,
  captureLog?: (log: (message: string) => void) => void,
) {
  const emitPlugin: ServerPlugin = {
    name: 'emit-runtime-message',
    setup(api) {
      api.onPrepare(() => {
        api.getServerContext().middlewares.push({
          name: 'runtime-response',
          handler: c => {
            const monitors = c.get('monitors');
            captureLog?.(message => {
              monitors?.info(message);
            });
            monitors?.info(message);
            return c.text(message);
          },
        });
      });
    },
  };
  const options = {
    pwd: process.cwd(),
    appContext: { apiDirectory: '', lambdaDirectory: '' },
    config: {
      html: {},
      output: {},
      source: {},
      tools: {},
      bff: {},
      dev: {},
      security: {},
      server: {
        logger: false,
        telemetry: {
          enabled: true,
          service: 'runtime-disposal-test',
          flushIntervalMs: 60_000,
          maxBatchSize: 500,
          exporters: {
            otlp: {
              enabled: true,
              endpoint: 'https://telemetry.example/v1/logs',
            },
          },
        },
      },
    },
    plugins: [ultramodernServerPlugin(), emitPlugin],
  } as unknown as ProdServerOptions;
  const server = createServerBase(options);
  runtimes.push(server);
  await applyPlugins(server, options, nodeServer as never);
  await server.init();
  return server;
}

afterEach(async () => {
  await Promise.allSettled(
    runtimes.splice(0).map(runtime => runtime.dispose()),
  );
  rstest.restoreAllMocks();
});

describe('telemetry runtime disposal', () => {
  test('retires each lane after a swap without accumulating Node close listeners', async () => {
    const bodies: string[] = [];
    rstest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url, options) => {
        bodies.push(String(options?.body ?? ''));
        return new Response('{}', { status: 200 });
      });
    const nodeServer = new EventEmitter();
    const listenerCount = nodeServer.listenerCount('close');
    const first = await createRuntime(nodeServer, 'first-runtime-event');
    let second: ReturnType<typeof createServerBase> | undefined;
    const manager = new ReloadManager({
      initialHandle: createDrainingHandle(first.handle, () => first.dispose()),
      build: async () => {
        second = await createRuntime(nodeServer, 'second-runtime-event');
        return createDrainingHandle(second.handle, () => second!.dispose());
      },
    });
    const firstResponse = await manager.handle(
      new Request('http://localhost/'),
    );
    expect(await firstResponse.text()).toBe('first-runtime-event');
    expect(bodies.some(body => body.includes('first-runtime-event'))).toBe(
      false,
    );
    await manager.reloadNow();
    expect(bodies.some(body => body.includes('first-runtime-event'))).toBe(
      true,
    );
    expect(nodeServer.listenerCount('close')).toBe(listenerCount);

    const beforeSecondRequest = bodies.length;
    const secondResponse = await manager.handle(
      new Request('http://localhost/'),
    );
    expect(await secondResponse.text()).toBe('second-runtime-event');
    expect(bodies).toHaveLength(beforeSecondRequest);
    manager.close();
    await second!.dispose();
    expect(bodies.some(body => body.includes('second-runtime-event'))).toBe(
      true,
    );
    expect(nodeServer.listenerCount('close')).toBe(listenerCount);
  });

  test('flushes the final event from a fork disposer before closing telemetry', async () => {
    const bodies: string[] = [];
    rstest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url, options) => {
        bodies.push(String(options?.body ?? ''));
        return new Response('{}', { status: 200 });
      });
    let log: ((message: string) => void) | undefined;
    const runtime = await createRuntime(
      new EventEmitter(),
      'runtime-with-resource',
      next => {
        log = next;
      },
    );
    await runtime.request('/', {}, {});
    const dispose = rstest.fn(() => {
      log!('disposer-final-event');
    });
    registerServerRuntimeDisposer(runtime, dispose);
    await runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(bodies.some(body => body.includes('disposer-final-event'))).toBe(
      true,
    );
  });

  test('cleans the telemetry registry when exporter startup health fails', async () => {
    rstest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('unavailable', { status: 503 }));
    const shutdown = rstest.spyOn(TelemetryRegistry.prototype, 'shutdown');
    await expect(
      createRuntime(new EventEmitter(), 'startup-failure'),
    ).rejects.toBeInstanceOf(Error);
    expect(shutdown).toHaveBeenCalledTimes(1);
    await runtimes[0]!.dispose();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  test('surfaces shutdown errors after releasing the lane', async () => {
    rstest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const originalShutdown = TelemetryRegistry.prototype.shutdown;
    const shutdownError = new Error('exporter shutdown failed');
    const shutdown = rstest
      .spyOn(TelemetryRegistry.prototype, 'shutdown')
      .mockImplementation(async function () {
        await originalShutdown.call(this);
        throw shutdownError;
      });
    const runtime = await createRuntime(new EventEmitter(), 'shutdown-failure');
    await expect(runtime.dispose()).rejects.toMatchObject({
      errors: [shutdownError],
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
    await expect(runtime.dispose()).rejects.toMatchObject({
      errors: [shutdownError],
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
