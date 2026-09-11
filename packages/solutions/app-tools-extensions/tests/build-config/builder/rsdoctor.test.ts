import { join } from 'node:path';
import type { Rspack } from '@rsbuild/core';
import { afterEach, describe, expect, rs, test } from '@rstest/core';
import { createBuilder } from '../../../../../cli/builder/src';

const getCompilerPlugins = async (
  plugins: Rspack.RspackPluginInstance[] = [],
) => {
  const rsbuild = await createBuilder({
    bundlerType: 'rspack',
    config: {
      output: { disableTsChecker: true },
      plugins: plugins.length
        ? [
            {
              name: 'test:existing-rsdoctor',
              setup(api) {
                api.modifyRspackConfig(config => {
                  config.plugins = [...(config.plugins ?? []), ...plugins];
                });
              },
            },
          ]
        : [],
    },
    cwd: join(__dirname, '../../../../../cli/builder'),
  });
  const compiler = await rsbuild.createCompiler();
  const compilers = 'compilers' in compiler ? compiler.compilers : [compiler];
  return compilers.flatMap(item => item.options.plugins ?? []);
};

describe('Rsbuild-native Rsdoctor integration', () => {
  afterEach(() => {
    rs.unstubAllEnvs();
  });

  test('does not add a duplicate when a build already has Rsdoctor', async () => {
    rs.stubEnv('RSDOCTOR', 'true');
    const existing = {
      isRsdoctorPlugin: true,
      apply() {},
    } as Rspack.RspackPluginInstance & { isRsdoctorPlugin: boolean };

    const plugins = await getCompilerPlugins([existing]);

    expect(plugins.filter(plugin => plugin === existing)).toHaveLength(1);
    expect(
      plugins.filter(
        plugin => plugin?.constructor?.name === 'RsdoctorRspackPlugin',
      ),
    ).toHaveLength(0);
  });
});
