import { bffPlugin as nativeBffPlugin } from '../../plugin-bff/src/cli';
import { bffPlugin } from '../src';

rstest.mock('@modern-js/plugin-bff', () => ({
  bffPlugin: nativeBffPlugin,
  default: nativeBffPlugin,
}));
rstest.mock('effect', () => {
  throw new Error('optional Effect peer was loaded by Hono');
});
rstest.mock('@effect/opentelemetry', () => {
  throw new Error('optional Effect telemetry was loaded by Hono');
});
rstest.mock('@modern-js/plugin-bff-extensions/client-generator', () => {
  throw new Error('Effect codegen was loaded by Hono');
});

test('Hono composition registers native hooks without resolving or importing Effect', async () => {
  const hooks = nativeBffPlugin().registryHooks!;
  let bundler: (chain: unknown, utils: { isServer: boolean }) => Promise<void>;
  const api = {
    config: rstest.fn(),
    getHooks: () => hooks,
    getConfig: () => ({ bff: { runtimeFramework: 'hono' } }),
    getAppContext: () => ({ bffRuntimeFramework: 'hono' }),
    updateAppContext: rstest.fn(),
    onBeforeBffCompile: hooks.onBeforeBffCompile.tap,
    onAfterBffCompile: hooks.onAfterBffCompile.tap,
    modifyBffClientArtifacts: hooks.modifyBffClientArtifacts.tap,
    modifyBffGeneratedEntries: hooks.modifyBffGeneratedEntries.tap,
    modifyBundlerChain: (callback: typeof bundler) => {
      bundler = callback;
    },
  };
  await bffPlugin().setup!(api as never);
  await bundler!({}, { isServer: false });
  expect(api.config.mock.calls[0][0]()).toEqual({
    bff: {
      requestCreator: '@modern-js/runtime-extensions/request-policy',
      runtimeCreateRequest: '@modern-js/runtime-extensions/request-policy',
      clientCodegenPlugin: require.resolve(
        '@modern-js/plugin-bff-build-extensions/hono-client-codegen',
      ),
    },
  });
  expect(api.updateAppContext).toHaveBeenCalledWith({
    bffRuntimeFramework: 'hono',
  });
});

describe('optional Effect peer', () => {
  test('loads the base BFF CLI without evaluating Effect', async () => {
    await expect(import('../../plugin-bff/src/cli')).resolves.toEqual(
      expect.objectContaining({
        bffPlugin: expect.any(Function),
      }),
    );
  });
});
