import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyUltraModernDocsPreset,
  ultraModernDocsAssets,
} from '../src/index.ts';

test('applies fork branding without discarding upstream Rspress behavior', () => {
  const retainedBuilderPlugin = { name: 'retained-builder-plugin', setup() {} };
  const upstreamOpenGraph = { name: 'rsbuild-plugin-open-graph', setup() {} };

  const config = applyUltraModernDocsPreset(
    {
      root: '/repo/packages/document/docs',
      title: 'Modern.js',
      description: 'upstream description',
      base: '/',
      logo: 'upstream-logo.svg',
      icon: 'upstream-favicon.ico',
      themeConfig: {
        locales: [
          { lang: 'zh', label: '简体中文' },
          { lang: 'en', label: 'English' },
        ],
        socialLinks: [
          { icon: 'discord', mode: 'link', content: 'https://discord.test' },
        ],
      },
      builderConfig: {
        plugins: [retainedBuilderPlugin, upstreamOpenGraph],
      },
    },
    {
      base: 'ultramodern.js',
      origin: 'https://bleedingdev.github.io/',
    },
  );

  assert.equal(config.base, '/ultramodern.js/');
  assert.deepEqual(config.logo, {
    light: '/ultramodern.js/img/ultramodern-logo-light.svg',
    dark: '/ultramodern.js/img/ultramodern-logo-dark.svg',
  });
  assert.equal(
    config.icon,
    'https://bleedingdev.github.io/ultramodern.js/img/favicon.ico',
  );
  assert.deepEqual(
    config.themeConfig?.locales?.map(locale => ({
      lang: locale.lang,
      label: locale.label,
      title: locale.title,
    })),
    [
      { lang: 'zh', label: '简体中文', title: 'UltraModern.js 3.0' },
      { lang: 'en', label: 'English', title: 'UltraModern.js 3.0' },
    ],
  );
  assert.deepEqual(config.themeConfig?.socialLinks, [
    { icon: 'discord', mode: 'link', content: 'https://discord.test' },
    {
      icon: 'github',
      mode: 'link',
      content: 'https://github.com/BleedingDev/ultramodern.js',
    },
  ]);
  assert.deepEqual(
    config.builderConfig?.plugins?.map(plugin => plugin.name),
    ['retained-builder-plugin', 'rsbuild-plugin-open-graph'],
  );
  assert.deepEqual(config.builderConfig?.server?.publicDir, [
    { name: '/repo/packages/document/static' },
    { name: fileURLToPath(ultraModernDocsAssets) },
  ]);
});

test('emits coherent Open Graph and Twitter metadata without an identity claim', () => {
  const config = applyUltraModernDocsPreset(
    { root: '/repo/packages/document/docs', builderConfig: {} },
    {
      base: '/ultramodern.js/',
      origin: 'https://bleedingdev.github.io',
    },
  );
  const plugin = config.builderConfig?.plugins?.find(
    candidate => candidate.name === 'rsbuild-plugin-open-graph',
  );
  assert.ok(plugin);

  let modifyConfig:
    | ((
        config: Record<string, unknown>,
        helpers: {
          mergeRsbuildConfig: (
            extra: Record<string, unknown>,
            current: Record<string, unknown>,
          ) => Record<string, unknown>;
        },
      ) => Record<string, unknown>)
    | undefined;
  plugin.setup({
    modifyRsbuildConfig(callback) {
      modifyConfig = callback;
    },
  } as never);
  assert.ok(modifyConfig);

  const result = modifyConfig(
    {},
    {
      mergeRsbuildConfig: extra => extra,
    },
  ) as { html: { meta: Record<string, { content: string }> } };
  const meta = result.html.meta;
  const image =
    'https://bleedingdev.github.io/ultramodern.js/img/ultramodern-social-card.png';

  assert.equal(meta['og:image']?.content, image);
  assert.equal(meta['twitter:image']?.content, image);
  assert.equal(meta['twitter:card']?.content, 'summary_large_image');
  assert.equal(meta['twitter:site'], undefined);
  assert.equal(meta['twitter:creator'], undefined);
});
