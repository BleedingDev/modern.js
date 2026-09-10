import { EventEmitter } from 'node:events';
import { createServerBase } from '@modern-js/server-core';
import {
  createNodeServer,
  loadServerEnv,
  loadServerRuntimeConfig,
} from '@modern-js/server-core/node';
import { logger } from '@modern-js/utils';
import { applyPlugins } from '../src/apply';
import { createProdServer } from '../src/index';

rstest.mock('@modern-js/server-core', () => ({
  createServerBase: rstest.fn(),
}));
rstest.mock('@modern-js/server-core/node', () => ({
  createNodeServer: rstest.fn(),
  loadServerCliConfig: rstest.fn(),
  loadServerEnv: rstest.fn(),
  loadServerPlugins: rstest.fn(),
  loadServerRuntimeConfig: rstest.fn(),
}));
rstest.mock('../src/apply', () => ({
  applyPlugins: rstest.fn(),
}));

const options = () =>
  ({
    appContext: {},
    config: { server: {} },
    pwd: '/tmp/runtime-lifecycle',
  }) as any;

const setup = (init: () => Promise<void>) => {
  const server = {
    handle: rstest.fn(),
    init: rstest.fn(init),
    dispose: rstest.fn(async () => {}),
  };
  const nodeServer = new EventEmitter();
  rstest.mocked(createServerBase).mockReturnValue(server as never);
  rstest.mocked(createNodeServer).mockResolvedValue(nodeServer as never);
  rstest.mocked(loadServerEnv).mockResolvedValue(undefined);
  rstest.mocked(loadServerRuntimeConfig).mockResolvedValue(undefined);
  rstest.mocked(applyPlugins).mockResolvedValue(undefined);
  return { nodeServer, server };
};

describe('production server runtime lifecycle', () => {
  test('releases the active runtime once when the node server closes', async () => {
    const { nodeServer, server } = setup(async () => {});
    const dispose = server.dispose;

    const result = await createProdServer(options());
    expect(result).toBe(nodeServer);

    nodeServer.emit('close');
    nodeServer.emit('close');
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('releases an initialized candidate when later setup fails', async () => {
    const setupError = new Error('server init failed');
    const { server } = setup(async () => {
      throw setupError;
    });
    const dispose = server.dispose;

    await expect(createProdServer(options())).rejects.toBe(setupError);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('preserves startup failure when cleanup fails and close follows', async () => {
    const setupError = new Error('server init failed');
    const cleanupError = new Error('server cleanup failed');
    const { nodeServer, server } = setup(async () => {
      throw setupError;
    });
    const errorSpy = rstest.spyOn(logger, 'error').mockImplementation(() => {});
    server.dispose.mockRejectedValue(cleanupError);
    try {
      await expect(createProdServer(options())).rejects.toBe(setupError);
      nodeServer.emit('close');
      await Promise.resolve();
      expect(server.dispose).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(cleanupError);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
