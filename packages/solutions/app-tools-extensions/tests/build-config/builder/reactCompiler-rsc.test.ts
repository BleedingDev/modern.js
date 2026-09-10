import { join } from 'node:path';
import type { Rspack } from '@rsbuild/core';
import { describe, expect, test } from '@rstest/core';
import {
  type BuilderConfig,
  createBuilder,
} from '../../../../../cli/builder/src';

function getSwcTransformOptions(config: Rspack.Configuration) {
  for (const rule of config.module?.rules || []) {
    if (!rule || typeof rule !== 'object') {
      continue;
    }
    const uses = Array.isArray(rule.use) ? rule.use : [rule.use];
    for (const use of uses) {
      if (
        use &&
        typeof use === 'object' &&
        use.loader?.includes('swc-loader') &&
        typeof use.options === 'object'
      ) {
        return (use.options as Rspack.SwcLoaderOptions).jsc?.transform;
      }
    }
  }
  return undefined;
}

async function getBundlerConfig(config: BuilderConfig, name = 'web') {
  const rsbuild = await createBuilder({
    bundlerType: 'rspack',
    config,
    cwd: join(__dirname, '../../../../../cli/builder'),
    internalDirectory: join(__dirname, '.modern-js'),
  });
  const {
    origin: { bundlerConfigs },
  } = await rsbuild.inspectConfig();
  return bundlerConfigs.find(item => item.name === name) ?? bundlerConfigs[0];
}

describe('React Compiler with native RSC environments', () => {
  test('keeps React Compiler enabled in an RSC server environment', async () => {
    const transform = getSwcTransformOptions(
      await getBundlerConfig(
        {
          environments: { server: { output: { target: 'node' } } },
          server: { rsc: { environments: { server: 'server' } } },
          source: { reactCompiler: true },
        },
        'server',
      ),
    );

    expect(transform?.reactCompiler).toBe(true);
  });
});
