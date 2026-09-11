import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createRsbuild, type RsbuildConfig } from '@rsbuild/core';
import { describe, expect, it } from '@rstest/core';
import { builderPluginAdapterPrecompress } from '../../../src/build-config/precompress/plugin';

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

  it('emits no compressed assets when precompress is not configured', async () => {
    const assets = await buildCompressedFixture(undefined);
    expect([...assets.keys()].some(name => name.endsWith('.js'))).toBe(true);
    expect([...assets.keys()].some(name => /\.(gz|br)$/.test(name))).toBe(
      false,
    );
  });
});
