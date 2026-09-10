import { createRslib, type RslibConfig } from '@rslib/core';
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import appToolsRslibConfig from '../rslib.config.mts';

const appToolsDirectory = path.resolve(__dirname, '..');
const temporaryDirectory = fs.mkdtempSync(
  path.join(appToolsDirectory, '.rslib-template-test-'),
);
const outputDirectory = path.join(temporaryDirectory, 'dist');

function getBuildConfig(): RslibConfig {
  return {
    ...appToolsRslibConfig,
    lib: appToolsRslibConfig.lib?.map(libConfig => ({
      ...libConfig,
      output: {
        ...libConfig.output,
        distPath: {
          ...libConfig.output?.distPath,
          root: path.join(
            outputDirectory,
            path.basename(libConfig.output?.distPath?.root ?? libConfig.id),
          ),
        },
      },
    })),
  };
}

describe('App Tools Rslib ESM loaders', () => {
  beforeAll(async () => {
    const rslib = await createRslib({
      cwd: appToolsDirectory,
      config: getBuildConfig(),
    });

    await rslib.build();
  }, 120_000);

  afterAll(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('loads emitted ESM loaders and compiled CJS runtime entries', async () => {
    for (const [file, expectedExports] of [
      ['register-esm.mjs', { registerPathsLoader: expect.any(Function) }],
      [
        'ts-paths-loader.mjs',
        { initialize: expect.any(Function), resolve: expect.any(Function) },
      ],
    ] as const) {
      const emitted = await import(
        `${pathToFileURL(path.join(outputDirectory, 'esm-node', 'esm', file)).href}?format=esm-node`
      );
      expect(emitted).toEqual(expect.objectContaining(expectedExports));

      const compiledCjs = require(
        path.join(
          outputDirectory,
          'cjs',
          'esm',
          file.replace(/\.mjs$/u, '.js'),
        ),
      );
      expect(compiledCjs).toEqual(expect.objectContaining(expectedExports));
    }
  }, 120_000);
});
