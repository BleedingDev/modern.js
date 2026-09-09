import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { rspack } from '@rsbuild/core';
import { UltramodernNativeTypeChecker } from '../src/native-type-checker';

const require = createRequire(import.meta.url);

test('watch recovers from initial errors and watches referenced type-only inputs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-watch-check-'));
  const options = {
    composite: true,
    declaration: true,
    emitDeclarationOnly: true,
    noEmit: false,
    types: [],
  };
  for (const [relative, value] of Object.entries({
    'lib/index.ts': 'export interface Value { name: number }',
    'lib/tsconfig.json': JSON.stringify({
      compilerOptions: options,
      files: ['index.ts'],
    }),
    'app/index.ts':
      "import type { Value } from '../lib'; export const item: Value = { name: 'ok' };",
    'app/tsconfig.json': JSON.stringify({
      compilerOptions: options,
      files: ['index.ts'],
      references: [{ path: '../lib' }],
    }),
  })) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  }
  const compiler = rspack({
    context: root,
    mode: 'development',
    devtool: false,
    entry: './app/index.ts',
    output: { path: path.join(root, 'dist') },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'builtin:swc-loader',
          options: { jsc: { parser: { syntax: 'typescript' } } },
        },
      ],
    },
    plugins: [
      new UltramodernNativeTypeChecker({
        build: true,
        configFile: path.join(root, 'app/tsconfig.json'),
        compiler: () =>
          path.join(
            path.dirname(
              require.resolve('@typescript/native-preview/package.json'),
            ),
            'bin/tsgo',
          ),
      }),
    ],
  });
  let watch: ReturnType<typeof compiler.watch> | undefined;
  try {
    const states: boolean[] = [];
    await new Promise<void>((resolve, reject) => {
      watch = compiler.watch({ aggregateTimeout: 20 }, (error, stats) => {
        try {
          expect(error).toBeNull();
          expect(stats).toBeDefined();
          states.push(stats!.hasErrors());
          if (states.length === 3) {
            resolve();
            return;
          }
          const type = states.length === 1 ? 'string' : 'number';
          fs.writeFileSync(
            path.join(root, 'lib/index.ts'),
            `export interface Value { name: ${type} }`,
          );
        } catch (cause) {
          reject(cause);
        }
      });
    });
    expect(states).toEqual([true, false, true]);
  } finally {
    if (watch)
      await new Promise<void>(resolve => watch!.close(() => resolve()));
    await new Promise<void>(resolve => compiler.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 20000);
