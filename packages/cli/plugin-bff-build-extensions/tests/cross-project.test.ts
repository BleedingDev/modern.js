import path from 'node:path';
import {
  type CrossProjectBffDescriptor,
  createCrossProjectBffPlugin,
} from '../src/cross-project';

const descriptor: CrossProjectBffDescriptor = {
  native: {
    packageName: '@fixture/producer',
    prefix: '/producer',
    relativeDistPath: 'output',
    relativeApiPath: 'api',
    relativeLambdaPath: 'api/lambda',
  },
  runtimeFramework: 'effect',
  relativeEffectEntry: 'api/effect/index.js',
  requestId: 'producer-request',
  operationContracts: {
    'GET:/producer/ping': { schemaHash: 'generated', operationVersion: 3 },
  },
};

async function run(
  config: Record<string, any> = {},
  resolved: Record<string, any> = {},
) {
  let callback: (config: never) => Promise<unknown>;
  const context: Record<string, unknown> = {
    appDirectory: path.resolve('consumer'),
  };
  const plugin = createCrossProjectBffPlugin(descriptor);
  await plugin.setup!({
    getAppContext: () => context,
    getConfig: () => config,
    updateAppContext: (update: Record<string, unknown>) =>
      Object.assign(context, update),
    modifyResolvedConfig: (fn: typeof callback) => {
      callback = fn;
    },
  } as never);
  await callback!(resolved as never);
  return { context, resolved, plugin };
}

test('retains native prefix rejection and producer runtime mismatch rejection', async () => {
  await expect(run({ bff: { prefix: '/other' } })).rejects.toThrow(
    'Invalid bff.prefix',
  );
  await expect(run({ bff: { runtimeFramework: 'hono' } })).rejects.toThrow(
    'Runtime framework mismatch',
  );
});

test('initializes consumers without BFF config and composes the native path factory', async () => {
  const { resolved, context, plugin } = await run();
  expect(plugin.name).toBe('@modern-js/plugin-independent-bff');
  expect(resolved.bff).toMatchObject({
    prefix: '/producer',
    runtimeFramework: 'effect',
    requestId: 'producer-request',
    isCrossProjectServer: true,
    crossProjectPolicy: {
      enabled: true,
      requireEnvelope: true,
      requireOperationContext: true,
      requireOperationContextDetails: true,
      requireOperationSchemaHash: true,
      requireOperationVersion: true,
      allowUnknownOperations: false,
    },
  });
  expect(context.apiDirectory).toBe(
    path.resolve('consumer/node_modules/@fixture/producer/output/api/effect'),
  );
  expect(context.lambdaDirectory).toBe(
    path.resolve('consumer/node_modules/@fixture/producer/output/api/lambda'),
  );
  expect(context.bffRuntimeFramework).toBe('effect');
});

test('retains user policy overrides and merges generated operation contracts last', async () => {
  const { resolved } = await run(
    {
      bff: {
        prefix: ['/producer'],
        runtimeFramework: 'effect',
        requestId: 'configured',
      },
    },
    {
      bff: {
        requestId: 'resolved',
        crossProjectPolicy: {
          requireEnvelope: false,
          requireOperationVersion: false,
          expectedOperationContracts: {
            'GET:/producer/ping': { schemaHash: 'stale' },
            'POST:/custom': { schemaHash: 'custom' },
          },
        },
      },
    },
  );
  expect(resolved.bff.requestId).toBe('resolved');
  expect(resolved.bff.crossProjectPolicy.requireEnvelope).toBe(false);
  expect(resolved.bff.crossProjectPolicy.requireOperationVersion).toBe(false);
  expect(resolved.bff.crossProjectPolicy.expectedOperationContracts).toEqual({
    ...descriptor.operationContracts,
    'POST:/custom': { schemaHash: 'custom' },
  });
});
