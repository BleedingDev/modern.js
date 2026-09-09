import { EventEmitter } from 'node:events';
import { createServerBase } from '@modern-js/server-core';
import {
  createNodeServer,
  loadServerRuntimeConfig,
} from '@modern-js/server-core/node';
import { logger } from '@modern-js/utils';
import { createDevServer } from '../src/createDevServer';
import { devRuntimeMiddlewarePlugin, setupDevInfra } from '../src/dev';
import type { ApplyPlugins, ModernDevServerOptions } from '../src/types';

rstest.mock('@modern-js/server-core', () => ({
  createServerBase: rstest.fn(),
}));
rstest.mock('@modern-js/server-core/node', () => ({
  createNodeServer: rstest.fn(),
  loadServerRuntimeConfig: rstest.fn(),
}));
rstest.mock('../src/dev', () => ({
  devRuntimeMiddlewarePlugin: rstest.fn(() => ({ name: 'dev-runtime' })),
  setupDevInfra: rstest.fn(),
}));
rstest.mock('../src/helpers', () => ({
  getDevOptions: () => ({}),
  getDevAssetPrefix: async () => '/assets/',
}));

const setup = () => {
  const nodeServer = Object.assign(new EventEmitter(), {
    close: rstest.fn(),
  });
  const builderDevServer = {
    close: rstest.fn(async () => {}),
    afterListen: rstest.fn(async () => {}),
  };
  const builder = {
    onAfterCreateCompiler: rstest.fn(),
    createDevServer: rstest.fn(async () => builderDevServer),
  };
  const options = {
    config: { output: {}, server: {}, dev: {} },
    pwd: '/tmp/native-dev-lifecycle',
    serverConfigPath: '/tmp/native-dev-lifecycle/modern.server.js',
    plugins: [{ name: 'user' }],
    appContext: {},
    builder,
  } as unknown as ModernDevServerOptions;
  const runtimes: Array<{
    serverOptions: Parameters<typeof createServerBase>[0];
    handle: ReturnType<typeof rstest.fn>;
    init: ReturnType<typeof rstest.fn>;
    dispose: ReturnType<typeof rstest.fn>;
    addPlugins: ReturnType<typeof rstest.fn>;
  }> = [];
  rstest.mocked(createServerBase).mockImplementation(serverOptions => {
    const index = runtimes.length;
    const runtime = {
      serverOptions,
      handle: rstest.fn(() => new Response(String(index))),
      init: rstest.fn(async () => {}),
      dispose: rstest.fn(async () => {}),
      addPlugins: rstest.fn(),
    };
    runtimes.push(runtime);
    return runtime as unknown as ReturnType<typeof createServerBase>;
  });
  rstest.mocked(createNodeServer).mockResolvedValue(nodeServer as never);
  rstest.mocked(loadServerRuntimeConfig).mockResolvedValue({});
  return { nodeServer, builder, builderDevServer, options, runtimes };
};

beforeEach(() => {
  rstest.clearAllMocks();
});
afterEach(() => {
  rstest.useRealTimers();
});

describe('native dev server lifecycle', () => {
  test('keeps process resources and builds fresh options for every runtime', async () => {
    rstest.useFakeTimers();
    const { nodeServer, builder, builderDevServer, options, runtimes } =
      setup();
    const applyPlugins = rstest.fn<ApplyPlugins>(
      async (_server, runtimeOptions) => {
        runtimeOptions.plugins!.push({ name: 'local-to-this-runtime' });
        runtimeOptions.serverConfig!.middlewares!.push({
          name: 'local-middleware',
          handler: (_c, next) => next(),
        });
      },
    );
    const result = await createDevServer(options, applyPlugins);
    const infra = rstest.mocked(setupDevInfra).mock.calls[0]![0];
    const forwardedHandle = rstest.mocked(createNodeServer).mock.calls[0]![0];
    expect(
      await (await forwardedHandle(new Request('http://localhost/'))).text(),
    ).toBe('0');

    infra.onFileChange('/tmp/native-dev-lifecycle/modern.server.js', 'change');
    await rstest.advanceTimersByTimeAsync(301);

    expect(result.server).toBe(nodeServer);
    expect(createNodeServer).toHaveBeenCalledTimes(1);
    expect(builder.createDevServer).toHaveBeenCalledTimes(1);
    expect(builder.onAfterCreateCompiler).toHaveBeenCalledTimes(1);
    expect(setupDevInfra).toHaveBeenCalledTimes(1);
    expect(devRuntimeMiddlewarePlugin).toHaveBeenCalledTimes(2);
    expect(runtimes).toHaveLength(2);
    expect(runtimes[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(runtimes[1]!.dispose).not.toHaveBeenCalled();
    expect(infra.getRuntimeServer()).toBe(runtimes[1]);
    expect(
      await (await forwardedHandle(new Request('http://localhost/'))).text(),
    ).toBe('1');
    expect(runtimes[0]!.serverOptions).not.toBe(runtimes[1]!.serverOptions);
    expect(runtimes[0]!.serverOptions.config).not.toBe(
      runtimes[1]!.serverOptions.config,
    );
    for (const [, runtimeOptions] of applyPlugins.mock.calls) {
      expect(runtimeOptions.plugins).toHaveLength(2);
      expect(runtimeOptions.serverConfig!.middlewares).toHaveLength(1);
      expect(runtimeOptions.config.output.assetPrefix).toBe('/assets/');
    }
    expect(options.plugins).toHaveLength(1);
    expect(options.config.output.assetPrefix).toBeUndefined();
    expect(builderDevServer.close).not.toHaveBeenCalled();
    await result.afterListen();
    expect(builderDevServer.afterListen).toHaveBeenCalledTimes(1);
    infra.onClose?.();
    await rstest.advanceTimersByTimeAsync(0);
    expect(runtimes[1]!.dispose).toHaveBeenCalledTimes(1);
  });

  test('cleans a failed reload candidate and preserves the active runtime', async () => {
    rstest.useFakeTimers();
    const { options, runtimes, builderDevServer } = setup();
    const errorSpy = rstest.spyOn(logger, 'error').mockImplementation(() => {});
    const candidateError = new Error('candidate setup failed');
    const applyPlugins = rstest.fn(async server => {
      if (runtimes.length === 2) {
        expect(server).toBe(runtimes[1]);
        throw candidateError;
      }
    });
    try {
      await createDevServer(options, applyPlugins);
      const infra = rstest.mocked(setupDevInfra).mock.calls[0]![0];
      infra.onFileChange(
        '/tmp/native-dev-lifecycle/modern.server.js',
        'change',
      );
      await rstest.advanceTimersByTimeAsync(301);
      expect(runtimes[1]!.dispose).toHaveBeenCalledTimes(1);
      expect(runtimes[0]!.dispose).not.toHaveBeenCalled();
      expect(infra.getRuntimeServer()).toBe(runtimes[0]);
      expect(builderDevServer.close).not.toHaveBeenCalled();
      const forward = rstest.mocked(createNodeServer).mock.calls[0]![0];
      expect(
        await (await forward(new Request('http://localhost/'))).text(),
      ).toBe('0');
      infra.onClose?.();
      await rstest.advanceTimersByTimeAsync(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('cleans initial runtime and process resources without replacing startup failure', async () => {
    const { options, runtimes, nodeServer, builderDevServer } = setup();
    const setupError = new Error('initial setup failed');
    const cleanupError = new Error('runtime cleanup failed');
    const errorSpy = rstest.spyOn(logger, 'error').mockImplementation(() => {});
    const applyPlugins = rstest.fn(async () => {
      runtimes[0]!.dispose.mockRejectedValue(cleanupError);
      throw setupError;
    });
    try {
      await expect(createDevServer(options, applyPlugins)).rejects.toBe(
        setupError,
      );
      expect(runtimes[0]!.dispose).toHaveBeenCalledTimes(1);
      expect(builderDevServer.close).toHaveBeenCalledTimes(1);
      expect(nodeServer.close).toHaveBeenCalledTimes(1);
      expect(setupDevInfra).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(cleanupError);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
