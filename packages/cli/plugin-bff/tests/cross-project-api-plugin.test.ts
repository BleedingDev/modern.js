import path from 'node:path';
import { createCrossProjectApiPlugin } from '../src/utils/crossProjectApiPlugin';

const nativeOptions = {
  packageName: '@fixture/producer',
  prefix: '/producer',
  relativeDistPath: 'output',
  relativeApiPath: 'api',
  relativeLambdaPath: 'api/lambda',
};

async function runWithConfig(
  config: Record<string, any>,
  initialResolvedConfig: Record<string, any> = {},
) {
  let modify: (config: never) => Promise<unknown>;
  const nextAppContext: Record<string, unknown> = {};
  const plugin = createCrossProjectApiPlugin(nativeOptions);
  await plugin.setup!({
    getAppContext: () => ({ appDirectory: path.resolve('consumer-app') }),
    updateAppContext: (update: Record<string, unknown>) =>
      Object.assign(nextAppContext, update),
    getConfig: () => config,
    modifyResolvedConfig: (modifier: typeof modify) => {
      modify = modifier;
    },
  } as never);
  await modify!(initialResolvedConfig as never);
  return { resolvedConfig: initialResolvedConfig, nextAppContext };
}

test('rejects conflicting prefixes and accepts the exact one-element prefix array', async () => {
  await expect(
    runWithConfig({ bff: { prefix: '/custom-prefix' } }),
  ).rejects.toThrow('Invalid bff.prefix');
  await expect(
    runWithConfig({ bff: { prefix: ['/producer', '/extra'] } }),
  ).rejects.toThrow('Invalid bff.prefix');
  const { resolvedConfig } = await runWithConfig({
    bff: { prefix: ['/producer'] },
  });
  expect(resolvedConfig.bff.prefix).toBe('/producer');
});

test('initializes native SDK directories and config without introducing runtime policy', async () => {
  const { resolvedConfig, nextAppContext } = await runWithConfig({});
  expect(resolvedConfig.bff).toEqual({
    prefix: '/producer',
    isCrossProjectServer: true,
  });
  expect(nextAppContext).toEqual({
    apiDirectory: path.resolve(
      'consumer-app/node_modules/@fixture/producer/output/api',
    ),
    lambdaDirectory: path.resolve(
      'consumer-app/node_modules/@fixture/producer/output/api/lambda',
    ),
  });
});

test('the extension callback receives validated native paths and its returned config is used', async () => {
  let modifier: (config: never) => Promise<unknown>;
  const callback = rstest.fn((config, context) => ({
    ...config,
    source: { sdk: context.sdkDistDirectory },
  }));
  const plugin = createCrossProjectApiPlugin({
    ...nativeOptions,
    modifyResolvedConfig: callback,
  });
  await plugin.setup!({
    getAppContext: () => ({ appDirectory: path.resolve('consumer-app') }),
    getConfig: () => ({}),
    updateAppContext: () => {},
    modifyResolvedConfig: (fn: typeof modifier) => {
      modifier = fn;
    },
  } as never);
  const result = await modifier!({} as never);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({
    bff: { prefix: '/producer', isCrossProjectServer: true },
    source: {
      sdk: path.resolve('consumer-app/node_modules/@fixture/producer/output'),
    },
  });
});
