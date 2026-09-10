import { createDefaultPlugins, createServerBase } from '@modern-js/server-core';
import {
  createDisposableServerRuntimeHandle,
  disposeServerRuntime,
  initializeDisposableServerRuntime,
  registerServerRuntimeDisposer,
} from '../src/runtimeLifecycle';
import { ultramodernServerPlugin } from '../src/serverPlugin';
import { getDefaultAppContext, getDefaultConfig } from './helpers';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(next => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('server runtime lifecycle', () => {
  test('attempts every owned disposer when one fails synchronously', async () => {
    const owner = {};
    const completed = rstest.fn();
    registerServerRuntimeDisposer(owner, completed);
    registerServerRuntimeDisposer(owner, () => {
      throw new Error('close failed');
    });

    await expect(disposeServerRuntime(owner)).rejects.toMatchObject({
      errors: [expect.objectContaining({ message: 'close failed' })],
    });
    expect(completed).toHaveBeenCalledTimes(1);
  });

  test('retires ownership before a disposer can register re-entrantly', async () => {
    const owner = {};
    registerServerRuntimeDisposer(owner, () => {
      expect(() => registerServerRuntimeDisposer(owner, () => {})).toThrow(
        'retired server runtime',
      );
    });

    await disposeServerRuntime(owner);
    await disposeServerRuntime(owner);
  });

  test('drains in-flight requests before releasing their runtime', async () => {
    const owner = {};
    const releaseRequest = deferred();
    const dispose = rstest.fn(async () => {});
    registerServerRuntimeDisposer(owner, dispose);
    const handle = createDisposableServerRuntimeHandle(owner, async () => {
      await releaseRequest.promise;
      return new Response('done');
    });

    const response = handle(new Request('https://example.com/slow'));
    const retiring = handle.dispose();
    await Promise.resolve();
    expect(dispose).not.toHaveBeenCalled();

    releaseRequest.resolve();
    await expect(response).resolves.toBeInstanceOf(Response);
    await retiring;
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(
      handle(new Request('https://example.com/late')),
    ).rejects.toThrow('retired server runtime');
  });

  test('releases a failed candidate without touching the active runtime', async () => {
    const activeOwner = {};
    const candidateOwner = {};
    const activeDispose = rstest.fn(async () => {});
    const candidateDispose = rstest.fn(async () => {});
    registerServerRuntimeDisposer(activeOwner, activeDispose);
    registerServerRuntimeDisposer(candidateOwner, candidateDispose);
    const setupError = new Error('candidate setup failed');

    await expect(
      initializeDisposableServerRuntime(
        candidateOwner,
        () => new Response('candidate'),
        async () => {
          throw setupError;
        },
      ),
    ).rejects.toBe(setupError);

    expect(candidateDispose).toHaveBeenCalledTimes(1);
    expect(activeDispose).not.toHaveBeenCalled();
    await disposeServerRuntime(activeOwner);
  });
});

describe('native lifecycle bridge', () => {
  test('disposes the same owner registered by a fork runtime', async () => {
    const server = createServerBase({
      config: getDefaultConfig(),
      pwd: '',
      appContext: getDefaultAppContext(),
    });
    const dispose = rstest.fn(async () => {});
    let observedOwner: object | undefined;
    server.addPlugins([
      ...createDefaultPlugins({ logger: false }),
      ultramodernServerPlugin(),
      {
        name: 'fork-runtime-owner',
        setup(api) {
          api.onPrepare(() => {
            observedOwner = api.getServerContext().serverBase;
            registerServerRuntimeDisposer(observedOwner!, dispose);
          });
        },
      },
    ]);
    await server.init();
    expect(observedOwner).toBe(server);
    await Promise.all([server.dispose(), server.dispose()]);
    expect(dispose).toHaveBeenCalledTimes(1);
    await disposeServerRuntime(server);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('cleans fork resources after a later native prepare failure', async () => {
    const server = createServerBase({
      config: getDefaultConfig(),
      pwd: '',
      appContext: getDefaultAppContext(),
    });
    const dispose = rstest.fn(async () => {});
    const prepareError = new Error('later prepare failed');
    server.addPlugins([
      ...createDefaultPlugins({ logger: false }),
      ultramodernServerPlugin(),
      {
        name: 'fork-runtime-owner',
        setup(api) {
          api.onPrepare(() => {
            registerServerRuntimeDisposer(
              api.getServerContext().serverBase,
              dispose,
            );
          });
        },
      },
      {
        name: 'later-failure',
        setup: api => {
          api.onPrepare(async () => {
            throw prepareError;
          });
        },
      },
    ]);
    await expect(server.init()).rejects.toBe(prepareError);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
