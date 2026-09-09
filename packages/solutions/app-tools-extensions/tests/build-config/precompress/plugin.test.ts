import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  brotliDecompressSync,
  gunzipSync,
  constants as zlibConstants,
} from 'node:zlib';
import { createRsbuild, type RsbuildConfig } from '@rsbuild/core';
import { describe, expect, it } from '@rstest/core';
import type CompressionPlugin from 'compression-webpack-plugin';
import { builderPluginAdapterPrecompress } from '../../../src/build-config/precompress/plugin';

type CompressionPluginOptions = NonNullable<
  ConstructorParameters<typeof CompressionPlugin>[0]
>;

const applyPrecompressPlugins = (
  precompress: unknown,
  env: { isProd: boolean; target: string } = { isProd: true, target: 'web' },
) => {
  const appliedPlugins: Array<{
    name: string;
    options: CompressionPluginOptions;
  }> = [];

  let modifyBundlerChain:
    | ((chain: unknown, utils: { isProd: boolean; target: string }) => void)
    | undefined;

  const plugin = builderPluginAdapterPrecompress(
    precompress as Parameters<typeof builderPluginAdapterPrecompress>[0],
  );

  plugin.setup?.({
    modifyBundlerChain(callback: NonNullable<typeof modifyBundlerChain>) {
      modifyBundlerChain = callback;
    },
  } as any);

  const chain = {
    plugin(name: string) {
      return {
        use(_pluginCtor: unknown, [options]: [CompressionPluginOptions]) {
          appliedPlugins.push({ name, options });
        },
      };
    },
  };

  modifyBundlerChain?.(chain, env);

  return appliedPlugins;
};

describe('builderPluginAdapterPrecompress', () => {
  it('does not enable precompress when core config leaves it undefined', () => {
    expect(applyPrecompressPlugins(undefined)).toEqual([]);
  });

  it('enables gzip and brotli when explicitly set to true', () => {
    const plugins = applyPrecompressPlugins(true);

    expect(plugins.map(plugin => plugin.name)).toEqual([
      'modern-precompress-gzip',
      'modern-precompress-brotli',
    ]);
  });

  it('preserves explicit codec configuration', () => {
    const plugins = applyPrecompressPlugins({
      gzip: false,
      brotli: {
        threshold: 2048,
      },
    });

    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe('modern-precompress-brotli');
    expect(plugins[0]?.options.threshold).toBe(2048);
  });

  it('merges brotli params with default quality', () => {
    const plugins = applyPrecompressPlugins({
      gzip: false,
      brotli: {
        compressionOptions: {
          params: {
            [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
          },
        },
      },
    });

    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.options.compressionOptions).toEqual({
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 9,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      },
    });
  });

  it('stays disabled when explicitly set to false', () => {
    expect(applyPrecompressPlugins(false)).toEqual([]);
  });
});

const buildCompressedFixture = async (
  precompress: Parameters<typeof builderPluginAdapterPrecompress>[0],
  config: RsbuildConfig = {},
) => {
  const directory = mkdtempSync(join(tmpdir(), 'modern-precompress-'));
  try {
    writeFileSync(
      join(directory, 'index.js'),
      `console.log(${JSON.stringify('compressible fixture text '.repeat(2000))});`,
    );
    const rsbuild = await createRsbuild({
      cwd: directory,
      rsbuildConfig: {
        mode: 'production',
        source: { entry: { index: './index.js' } },
        output: { distPath: { root: 'dist' }, minify: false },
        plugins: [builderPluginAdapterPrecompress(precompress)],
        ...config,
      },
    });
    await rsbuild.build();
    const dist = join(directory, 'dist');
    return new Map(
      readdirSync(dist, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => [
          entry.name,
          readFileSync(join(entry.parentPath, entry.name)),
        ]),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe('real native Rsbuild precompression output', () => {
  it('emits gzip and Brotli assets that decode to the original JavaScript', async () => {
    const assets = await buildCompressedFixture(true);
    const name = [...assets.keys()].find(name => name.endsWith('.js'))!;
    expect(assets.has(`${name}.gz`)).toBe(true);
    expect(assets.has(`${name}.br`)).toBe(true);
    expect(gunzipSync(assets.get(`${name}.gz`)!)).toEqual(assets.get(name));
    expect(brotliDecompressSync(assets.get(`${name}.br`)!)).toEqual(
      assets.get(name),
    );
  });

  it('preserves codec disablement and user Rspack chain overrides', async () => {
    const assets = await buildCompressedFixture(
      { brotli: false, gzip: { threshold: 0 } },
      {
        tools: {
          bundlerChain(chain) {
            chain
              .plugin('modern-precompress-gzip')
              .tap(([options]) => [
                { ...options, filename: '[path][base].custom.gz' },
              ]);
          },
        },
      },
    );
    const name = [...assets.keys()].find(name => name.endsWith('.js'))!;
    expect(gunzipSync(assets.get(`${name}.custom.gz`)!)).toEqual(
      assets.get(name),
    );
    expect(assets.has(`${name}.gz`)).toBe(false);
    expect([...assets.keys()].some(name => name.endsWith('.br'))).toBe(false);
  });

  it('respects explicit thresholds in real output', async () => {
    const assets = await buildCompressedFixture({
      gzip: { threshold: 1000000 },
      brotli: false,
    });
    expect([...assets.keys()].some(name => /\.(gz|br)$/.test(name))).toBe(
      false,
    );
  });

  it('does not attach compression to development or non-web targets', () => {
    expect(
      applyPrecompressPlugins(true, { isProd: false, target: 'web' }),
    ).toEqual([]);
    expect(
      applyPrecompressPlugins(true, { isProd: true, target: 'node' }),
    ).toEqual([]);
  });
});
