import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import postcss from 'postcss';
import { createBuilder } from '../../../../../cli/builder/src';
import { loadPostcssPlugin } from '../../../../../cli/builder/src/plugins/postcss';
import {
  matchRules,
  unwrapConfig,
} from '../../../../../cli/builder/tests/helper';

const getPluginName = (plugin: unknown): string | undefined => {
  if (plugin && typeof plugin === 'object' && 'postcssPlugin' in plugin) {
    return (plugin as { postcssPlugin?: string }).postcssPlugin;
  }
  return undefined;
};

/** Collect every PostCSS plugin array attached to a matched loader rule. */
const collectPostcssPluginsArrays = (config: any): unknown[][] => {
  const result: unknown[][] = [];
  const seen = new WeakSet<object>();

  const visitRule = (rule: any) => {
    if (!rule || typeof rule !== 'object' || seen.has(rule)) {
      return;
    }
    seen.add(rule);

    const uses = Array.isArray(rule.use) ? rule.use : [rule.use];
    for (const use of uses) {
      if (
        use &&
        typeof use === 'object' &&
        typeof use.loader === 'string' &&
        use.loader.includes('postcss-loader') &&
        Array.isArray(use.options?.postcssOptions?.plugins)
      ) {
        result.push(use.options.postcssOptions.plugins);
      }
    }

    for (const children of [rule.oneOf, rule.rules]) {
      if (!Array.isArray(children)) {
        continue;
      }
      for (const child of children) {
        visitRule(child);
      }
    }
  };

  for (const rule of matchRules({ config, testFile: 'a.css' })) {
    visitRule(rule);
  }
  return result;
};

describe('plugin-postcss', () => {
  it('should configure user postcss.config plugins exactly once in each matching loader', async () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), 'builder-postcss-run-'));

    try {
      writeFileSync(
        path.join(appRoot, 'package.json'),
        JSON.stringify({ name: 'postcss-run-root', version: '1.0.0' }),
      );
      writeFileSync(
        path.join(appRoot, 'postcss.config.cjs'),
        `const markerPlugin = () => ({
  postcssPlugin: 'test-marker-user-plugin',
  Once(root) {
    root.append({ prop: '--test-marker-user-runs', value: '1' });
  },
});
markerPlugin.postcss = true;
module.exports = { plugins: [markerPlugin] };
`,
      );

      const rsbuild = await createBuilder({
        bundlerType: 'rspack',
        config: {
          output: {
            overrideBrowserslist: ['chrome >= 87'],
          },
        },
        cwd: appRoot,
      });
      const config = await unwrapConfig(rsbuild);
      const pluginsArrays = collectPostcssPluginsArrays(config);

      expect(pluginsArrays.length).toBeGreaterThan(0);

      for (const plugins of pluginsArrays) {
        const names = plugins.map(getPluginName);
        expect(
          names.filter(name => name === 'test-marker-user-plugin'),
        ).toEqual(['test-marker-user-plugin']);
        expect(names.filter(name => name === 'autoprefixer')).toEqual([
          'autoprefixer',
        ]);
        expect(names.indexOf('test-marker-user-plugin')).toBeLessThan(
          names.indexOf('autoprefixer'),
        );

        const result = await postcss(plugins as any).process(
          '.marker { color: red; }',
          { from: undefined },
        );
        expect(
          result.css.match(/--test-marker-user-runs/gu) ?? [],
        ).toHaveLength(1);
      }
    } finally {
      rmSync(appRoot, { recursive: true, force: true });
    }
  });

  it('should resolve postcss plugins from the app root when the builder cannot resolve them', () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), 'builder-postcss-root-'));

    try {
      const pluginName = 'test-postcss-plugin-from-app-root';
      const pluginDir = path.join(appRoot, 'node_modules', pluginName);
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        path.join(appRoot, 'package.json'),
        JSON.stringify({ name: 'app-root', version: '1.0.0', private: true }),
      );
      writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: pluginName,
          version: '1.0.0',
          main: 'index.js',
        }),
      );
      writeFileSync(
        path.join(pluginDir, 'index.js'),
        `module.exports = { postcssPlugin: '${pluginName}' };\n`,
      );

      expect(loadPostcssPlugin(pluginName, appRoot)).toEqual({
        postcssPlugin: pluginName,
      });
    } finally {
      rmSync(appRoot, { recursive: true, force: true });
    }
  });

  it('should throw when a postcss plugin cannot be resolved anywhere', () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), 'builder-postcss-empty-'));

    try {
      expect(() =>
        loadPostcssPlugin('test-postcss-plugin-that-does-not-exist', appRoot),
      ).toThrow(/test-postcss-plugin-that-does-not-exist/);
    } finally {
      rmSync(appRoot, { recursive: true, force: true });
    }
  });
});
