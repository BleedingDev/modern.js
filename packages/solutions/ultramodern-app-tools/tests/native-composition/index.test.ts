import { appTools } from '@modern-js/app-tools';
import { createPluginManager } from '@modern-js/plugin';
import {
  createPresetUltramodernConfig,
  presetUltramodern,
  ultramodernAppTools,
} from '@modern-js/ultramodern-app-tools';
import { createRsbuild } from '@rsbuild/core';

describe('native UltraModern composition', () => {
  it('exports the preset and composes each native CLI plugin once', () => {
    expect(createPresetUltramodernConfig).toBeDefined();
    expect(presetUltramodern).toBeDefined();
    const native = appTools();
    const manager = createPluginManager();
    manager.addPlugins([ultramodernAppTools()]);
    const plugins = manager.getPlugins();
    for (const name of [
      '@modern-js/app-tools',
      '@modern-js/backend-federation-build',
      '@modern-js/cloudflare-builder',
      '@modern-js/deploy-output-aliases',
      '@modern-js/ultramodern-release-envelope',
      ...(native.usePlugins ?? []).map(plugin => plugin.name),
    ]) {
      expect(plugins.filter(plugin => plugin.name === name)).toHaveLength(1);
    }
    expect(
      native.usePlugins?.some(
        plugin => plugin.name === '@modern-js/cloudflare-builder',
      ),
    ).toBe(false);
  });

  it.each([
    { precompress: false, expected: 0 },
    { precompress: { gzip: false, brotli: { threshold: 42 } }, expected: 1 },
    { precompress: undefined, expected: 2 },
  ])('uses merged precompression options and preserves consumer plugins: $expected', async ({
    precompress,
    expected,
  }) => {
    const calls: string[] = [];
    const consumerPlugin = {
      name: 'consumer-plugin',
      setup() {
        calls.push('consumer');
      },
    };
    const config = presetUltramodern({
      output: { precompress },
      builderPlugins: [consumerPlugin],
    });
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        mode: 'production',
        plugins: config.builderPlugins,
      },
    });
    const [rspackConfig] = await rsbuild.initConfigs();
    const compression =
      rspackConfig.plugins?.filter(
        plugin => plugin?.constructor.name === 'CompressionPlugin',
      ) ?? [];
    expect(compression).toHaveLength(expected);
    expect(calls).toEqual(['consumer']);
    expect(config.builderPlugins).toContainEqual(consumerPlugin);
  });
});
