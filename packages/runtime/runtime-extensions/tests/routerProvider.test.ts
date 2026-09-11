import { createRouterPlugin } from '../src/routerProvider';

test('selects the injected app-local factory from runtime config and preserves native hook objects', () => {
  const registryHooks = { afterCreate: { call() {} } };
  const defaultFactory = rstest.fn(() => ({ setup: rstest.fn() }));
  const setup = rstest.fn();
  const localFactory = rstest.fn(() => ({ registryHooks, setup }));
  const plugin = createRouterPlugin({
    defaultProvider: { name: 'native', factory: defaultFactory },
    registryHooks,
    localProviders: [{ name: 'custom', factory: localFactory }],
  })();
  const api = { getRuntimeConfig: () => ({ router: { framework: 'custom' } }) };
  expect(plugin.registryHooks).toBe(registryHooks);
  plugin.setup(api);
  expect(localFactory).toHaveBeenCalledWith({});
  expect(setup).toHaveBeenCalledWith(api);
  expect(defaultFactory).not.toHaveBeenCalled();
});

test('rejects missing local providers', () => {
  const factory = createRouterPlugin({
    defaultProvider: { name: 'native', factory: () => ({}) },
    registryHooks: {},
  });
  expect(() =>
    factory({ framework: 'foreign' }).setup({ getRuntimeConfig: () => ({}) }),
  ).toThrow(/app-owned router provider realm/);
});
