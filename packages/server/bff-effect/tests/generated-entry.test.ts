import { createEffectBffEdgeDispatcher } from '../src/effect/edge-dispatcher';
import { createEffectBffEdgeDispatcherFactory } from '../src/effect/generated-entry';

rstest.mock('../src/effect/edge-dispatcher', () => ({
  createEffectBffEdgeDispatcher: rstest.fn(options => options),
}));

afterEach(() => rstest.clearAllMocks());

test('generated contracts win while caller policy and module identity are preserved', () => {
  const module = { api: {} };
  const generated = {
    'GET:/api/ping': { schemaHash: 'generated', operationVersion: 2 },
  };
  const policy = {
    enabled: false,
    expectedOperationContracts: {
      'GET:/api/ping': { schemaHash: 'stale' },
      'POST:/custom': { schemaHash: 'custom' },
    },
  };
  const factory = createEffectBffEdgeDispatcherFactory(module, generated);
  factory({ prefix: '/api', crossProjectPolicy: policy as never });
  expect(createEffectBffEdgeDispatcher).toHaveBeenCalledWith({
    module,
    prefix: '/api',
    crossProjectPolicy: {
      ...policy,
      expectedOperationContracts: {
        ...policy.expectedOperationContracts,
        ...generated,
      },
    },
  });
  expect(
    rstest.mocked(createEffectBffEdgeDispatcher).mock.calls[0][0].module,
  ).toBe(module);
  expect(policy.expectedOperationContracts['GET:/api/ping'].schemaHash).toBe(
    'stale',
  );
});
