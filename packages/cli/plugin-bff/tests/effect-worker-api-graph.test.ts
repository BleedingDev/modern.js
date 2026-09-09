import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { rspack } from '@rsbuild/core';

const require = createRequire(import.meta.url);

test('worker API helpers execute while browser imports remain blocked', async () => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'effect-worker-api-graph-')),
  );
  const apiDir = path.join(root, 'api');
  await fs.mkdir(path.join(apiDir, 'nested'), { recursive: true });
  const entry = path.join(apiDir, 'index.ts');
  const helper = path.join(apiDir, 'nested', 'value.ts');
  const service = path.join(apiDir, 'service.ts');
  await fs.writeFile(entry, "export { readiness } from './service';");
  await fs.writeFile(
    service,
    "import { value } from './nested/value'; export const readiness = () => value;",
  );
  await fs.writeFile(helper, 'export const value: number = 42;');

  const compile = async (name: string, request: string) => {
    const compiler = rspack({
      context: root,
      mode: 'development',
      target: 'node',
      devtool: false,
      entry: request,
      output: {
        path: path.join(root, name),
        filename: 'index.cjs',
        library: { type: 'commonjs2' },
      },
      resolve: { extensions: ['.ts', '.js'] },
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: [
              {
                loader: path.resolve(__dirname, '../dist/cjs/loader.js'),
                options: {
                  apiDir,
                  appDir: root,
                  bffRuntimeFramework: 'effect',
                  effectEntry: entry,
                  existLambda: false,
                  lambdaDir: path.join(apiDir, 'lambda'),
                  port: 8080,
                  prefix: '/api',
                  target: 'web',
                },
              },
            ],
          },
        ],
      },
    });
    try {
      return await new Promise<Set<string>>((resolve, reject) =>
        compiler.run((error, stats) => {
          if (error || !stats || stats.hasErrors()) {
            reject(
              error ?? new Error(stats?.toString({ all: false, errors: true })),
            );
          } else {
            resolve(new Set(stats.compilation.fileDependencies));
          }
        }),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        compiler.close(error => (error ? reject(error) : resolve())),
      );
    }
  };
  try {
    const dependencies = await compile(
      'worker',
      `${entry}?modern-bff-runtime-source`,
    );
    expect(require(path.join(root, 'worker/index.cjs')).readiness()).toBe(42);
    expect(dependencies.has(helper)).toBe(true);
    expect(dependencies.has(service)).toBe(true);
    await compile('browser', service);
    expect(() => require(path.join(root, 'browser/index.cjs'))).toThrow(
      'is not allowed to be imported in src directory',
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
