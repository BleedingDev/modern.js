import LoadablePlugin from '../../../src/cli/ssr/loadable-bundler-plugin';

const createCompiler = (chunkLoadingGlobal?: string) => {
  const definitions: Array<Record<string, string>> = [];
  const definePluginApply = rstest.fn();

  class DefinePlugin {
    constructor(value: Record<string, string>) {
      definitions.push(value);
    }

    apply = definePluginApply;
  }

  return {
    compiler: {
      options: {
        output: {
          chunkLoadingGlobal,
        },
      },
      webpack: {
        DefinePlugin,
      },
    },
    definitions,
    definePluginApply,
  };
};

describe('LoadableBundlerPlugin chunk loading global', () => {
  test.each([
    {
      name: 'preserves a configured compiler output value',
      configured: '__REMOTE_INVENTORY_CHUNKS__',
      option: undefined,
      expected: '__REMOTE_INVENTORY_CHUNKS__',
    },
    {
      name: 'uses the legacy fallback when no value is configured',
      configured: undefined,
      option: undefined,
      expected: '__LOADABLE_LOADED_CHUNKS__',
    },
    {
      name: 'prefers the explicit plugin option over compiler output',
      configured: '__REMOTE_INVENTORY_CHUNKS__',
      option: '__EXPLICIT_CHUNKS__',
      expected: '__EXPLICIT_CHUNKS__',
    },
  ])('$name', ({ configured, option, expected }) => {
    const { compiler, definitions, definePluginApply } =
      createCompiler(configured);
    const plugin = new LoadablePlugin({
      filename: 'loadable-stats.json',
      outputAsset: false,
      ...(option === undefined ? {} : { chunkLoadingGlobal: option }),
    });

    plugin.apply(compiler as never);

    expect(compiler.options.output.chunkLoadingGlobal).toBe(expected);
    expect(definitions).toEqual([
      {
        __MODERN_CHUNK_LOADING_GLOBAL__: JSON.stringify(expected),
      },
    ]);
    expect(definePluginApply).toHaveBeenCalledWith(compiler);
  });
});
