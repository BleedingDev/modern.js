import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import clientGenerator, {
  type APILoaderOptions,
} from '../src/utils/clientGenerator';
import runtimeGenerator from '../src/utils/runtimeGenerator';

const require = createRequire(import.meta.url);

describe('plugin-bff generator regressions', () => {
  test('runtime generator exposes initProducerClient defaults', async () => {
    const appDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'modern-plugin-bff-runtime-'),
    );

    try {
      await fs.promises.writeFile(
        path.join(appDir, 'package.json'),
        JSON.stringify({ name: 'runtime-app', version: '1.0.0' }, null, 2),
      );
      await runtimeGenerator({
        runtime: '@modern-js/plugin-bff/client',
        appDirectory: appDir,
        relativeDistPath: '.modern-js',
      });

      const generatedRuntimeDirectory = path.join(
        appDir,
        '.modern-js',
        'runtime',
      );
      const requestRuntimeDirectory = path.join(
        appDir,
        '.modern-js',
        'node_modules',
        '@modern-js',
        'plugin-bff',
      );
      await fs.promises.mkdir(requestRuntimeDirectory, { recursive: true });
      await fs.promises.writeFile(
        path.join(requestRuntimeDirectory, 'package.json'),
        JSON.stringify({
          exports: { './client': './client.js' },
          name: '@modern-js/plugin-bff',
        }),
      );
      await fs.promises.writeFile(
        path.join(requestRuntimeDirectory, 'client.js'),
        'exports.configure = options => options;',
      );
      const generatedRequire = createRequire(
        path.join(generatedRuntimeDirectory, 'index.js'),
      );
      const generatedRuntime = generatedRequire('./index.js') as {
        configure: (options?: Record<string, unknown>) => unknown;
        initProducerClient: (options?: Record<string, unknown>) => unknown;
      };
      const expectedDefaults = { requestId: 'runtime-app' };

      expect(generatedRuntime.initProducerClient()).toEqual(expectedDefaults);
      expect(generatedRuntime.configure()).toEqual(expectedDefaults);
      expect(generatedRuntime.configure).toBe(
        generatedRuntime.initProducerClient,
      );
    } finally {
      await fs.promises.rm(appDir, { recursive: true, force: true });
    }
  });

  test('client generator fails fast on package export collisions', async () => {
    const appDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'modern-plugin-bff-collision-'),
    );

    try {
      const apiDir = path.join(appDir, 'api');
      const lambdaDir = path.join(apiDir, 'lambda');
      await fs.promises.mkdir(apiDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(appDir, 'package.json'),
        JSON.stringify(
          {
            name: 'collision-app',
            version: '1.0.0',
            exports: {
              './api/*': {
                import: './custom/api/*.js',
                types: './custom/api/*.d.ts',
              },
            },
          },
          null,
          2,
        ),
      );

      const options: APILoaderOptions = {
        prefix: '/api',
        appDir,
        apiDir,
        lambdaDir,
        existLambda: false,
        port: 8080,
        relativeDistPath: '.modern-js',
        relativeApiPath: './api',
        apiFiles: [],
      };

      await expect(clientGenerator(options)).rejects.toThrow(
        /package\.json exports conflict/,
      );
    } finally {
      await fs.promises.rm(appDir, { recursive: true, force: true });
    }
  });
});
