import { logger } from '@modern-js/utils';
import { createDefaultPlugins, createServerBase } from '../src';
import { getDefaultAppContext, getDefaultConfig } from './helpers';

describe('server base', () => {
  it('should support registering options handler', async () => {
    const server = createServerBase({
      config: getDefaultConfig(),
      pwd: '',
      appContext: getDefaultAppContext(),
    });

    server.options('/api/ping', c => c.body(null, 204));

    const response = await server.request('/api/ping', {
      method: 'OPTIONS',
    });

    expect(response.status).toBe(204);
    expect(response.body).toBe(null);
  });
});

describe('server disposal', () => {
  const createRuntime = () => {
    const server = createServerBase({
      config: getDefaultConfig(),
      pwd: '',
      appContext: getDefaultAppContext(),
    });
    server.addPlugins(createDefaultPlugins({ logger: false }));
    return server;
  };

  it('registers disposal before a later synchronous plugin setup fails', async () => {
    const server = createRuntime();
    const dispose = rstest.fn();
    const setupError = new Error('later setup failed');
    server.addPlugins([
      {
        name: 'resource',
        setup: api => {
          api.onDispose(dispose);
        },
      },
      {
        name: 'failure',
        setup: () => {
          throw setupError;
        },
      },
    ]);

    await expect(server.init()).rejects.toBe(setupError);
    expect(dispose).toHaveBeenCalledTimes(1);
    await server.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('cleans registered resources when modifyConfig fails', async () => {
    const server = createRuntime();
    const dispose = rstest.fn();
    const configError = new Error('config failed');
    server.addPlugins([
      {
        name: 'resource',
        setup(api) {
          api.onDispose(dispose);
          api.modifyConfig(() => {
            throw configError;
          });
        },
      },
    ]);
    await expect(server.init()).rejects.toBe(configError);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('preserves an asynchronous prepare failure when cleanup also fails', async () => {
    const server = createRuntime();
    const prepareError = new Error('prepare failed');
    const cleanupError = new Error('cleanup failed');
    const errorSpy = rstest.spyOn(logger, 'error').mockImplementation(() => {});
    const dispose = rstest.fn(async () => {
      throw cleanupError;
    });
    server.addPlugins([
      {
        name: 'resource',
        setup(api) {
          api.onDispose(dispose);
          api.onPrepare(async () => {
            throw prepareError;
          });
        },
      },
    ]);
    try {
      await expect(server.init()).rejects.toBe(prepareError);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [cleanupError],
        }),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('attempts every resource in reverse registration order after failures', async () => {
    const server = createRuntime();
    const order: string[] = [];
    const syncError = new Error('synchronous cleanup');
    const asyncError = new Error('asynchronous cleanup');
    server.onDispose(() => {
      order.push('first');
    });
    server.onDispose(async () => {
      order.push('second');
      throw asyncError;
    });
    server.onDispose(() => {
      order.push('third');
      throw syncError;
    });

    await expect(server.dispose()).rejects.toMatchObject({
      errors: [syncError, asyncError],
    });
    expect(order).toEqual(['third', 'second', 'first']);
  });

  it('retires synchronously and shares concurrent and repeated disposal', async () => {
    const server = createRuntime();
    let release!: () => void;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    const dispose = rstest.fn(() => pending);
    server.onDispose(dispose);

    const first = server.dispose();
    expect(server.dispose()).toBe(first);
    expect(() => server.onDispose(() => {})).toThrow('retired server');
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(server.dispose()).toBe(first);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('allows a resource to unregister before retirement', async () => {
    const server = createRuntime();
    const dispose = rstest.fn();
    const unregister = server.onDispose(dispose);
    unregister();
    unregister();
    await server.dispose();
    expect(dispose).not.toHaveBeenCalled();
  });
});
