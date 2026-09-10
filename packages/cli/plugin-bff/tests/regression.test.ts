import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import defaultBffPlugin, { bffPlugin } from '../src/cli';
import clientGenerator, {
  type APILoaderOptions,
} from '../src/utils/clientGenerator';
import runtimeGenerator from '../src/utils/runtimeGenerator';

const require = createRequire(import.meta.url);

describe('plugin-bff regressions', () => {
  test('default and named CLI exports create the same public plugin', () => {
    expect(defaultBffPlugin).toBe(bffPlugin);
    expect(defaultBffPlugin().name).toBe('@modern-js/plugin-bff');
  });

  test('package server export restores Hono and retires fork runtime aliases', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
    );
    expect(packageJson.exports['./package.json']).toBe('./package.json');
    expect(packageJson.exports['./server']).toEqual({
      types: './dist/types/runtime/hono/index.d.ts',
      node: {
        import: './dist/esm-node/runtime/hono/index.mjs',
        require: './dist/cjs/runtime/hono/index.js',
      },
      default: './dist/cjs/runtime/hono/index.js',
    });
    expect(packageJson.typesVersions['*'].server).toEqual([
      './dist/types/runtime/hono/index.d.ts',
    ]);
    const serverEntry = require('@modern-js/plugin-bff/server');
    expect(serverEntry.Api).toBeTypeOf('function');
    for (const retired of [
      'hono-server',
      'effect',
      'effect-server',
      'effect-edge',
      'effect-edge/dispatcher',
      'effect-client',
      'effect-client-runtime',
      'data-platform',
    ]) {
      expect(packageJson.exports[`./${retired}`]).toBeUndefined();
      expect(packageJson.typesVersions['*'][retired]).toBeUndefined();
      expect(() =>
        require.resolve(`@modern-js/plugin-bff/${retired}`),
      ).toThrow();
    }
  });

  test('native server entry does not statically load extension runtimes', async () => {
    const result = await build({
      bundle: true,
      entryPoints: [path.resolve(__dirname, '../src/server.ts')],
      format: 'esm',
      metafile: true,
      outdir: 'out',
      packages: 'external',
      platform: 'node',
      splitting: true,
      write: false,
    });
    const entryOutput = Object.values(result.metafile.outputs).find(output =>
      output.entryPoint?.endsWith('/server.ts'),
    );
    if (!entryOutput) {
      throw new Error('server entry output was not generated');
    }
    expect(
      entryOutput.imports.filter(
        moduleImport =>
          moduleImport.kind === 'import-statement' &&
          (moduleImport.path === 'effect' ||
            moduleImport.path.startsWith('effect/') ||
            moduleImport.path.startsWith('@effect/') ||
            moduleImport.path.startsWith('@modern-js/bff-effect/') ||
            moduleImport.path ===
              '@modern-js/plugin-bff-extensions/effect-adapter'),
      ),
    ).toEqual([]);
  });

  test('client generator skips lambda scan when existLambda is false', async () => {
    const appDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'modern-plugin-bff-regression-'),
    );

    try {
      const apiDir = path.join(appDir, 'api');
      const lambdaDir = path.join(apiDir, 'lambda');
      await fs.promises.mkdir(apiDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(appDir, 'package.json'),
        JSON.stringify({ name: 'regression-app', version: '1.0.0' }, null, 2),
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

      await expect(clientGenerator(options)).resolves.toBeNull();
    } finally {
      await fs.promises.rm(appDir, { recursive: true, force: true });
    }
  });

  test('runtime generator exposes initProducerClient alias', async () => {
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
