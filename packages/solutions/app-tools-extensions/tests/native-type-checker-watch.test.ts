import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rspack } from '@rsbuild/core';
import { UltramodernNativeTypeChecker } from '../src/native-type-checker';

const require = createRequire(import.meta.url);
const { default: getExePath } = await import(
  pathToFileURL(
    path.join(
      path.dirname(require.resolve('@typescript/native-preview/package.json')),
      'lib/getExePath.js',
    ),
  ).href
);

test('watch recovers from initial errors and watches referenced type-only inputs', async () => {
  // Native Windows watcher events use long paths, not 8.3 TEMP aliases.
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'native-watch-check-'),
  );
  const root = fs.realpathSync.native(temporaryRoot);
  const configRoot = process.platform === 'win32' ? temporaryRoot : root;
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
        configFile: path.join(configRoot, 'app/tsconfig.json'),
        compiler: () => getExePath(),
      }),
    ],
  });
  let watch: ReturnType<typeof compiler.watch> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let pendingWrite: ReturnType<typeof setImmediate> | undefined;
  let finished = false;
  try {
    const states: boolean[] = [];
    await new Promise<void>((resolve, reject) => {
      const fail = (cause: unknown) => {
        finished = true;
        clearTimeout(deadline);
        reject(cause);
      };
      deadline = setTimeout(
        () =>
          fail(
            new Error(`Native watch stalled after states ${states.join(', ')}`),
          ),
        15000,
      );
      watch = compiler.watch({ aggregateTimeout: 20 }, (error, stats) => {
        if (finished) return;
        try {
          expect(error).toBeNull();
          expect(stats).toBeDefined();
          expect(
            stats!.compilation.fileDependencies.has(
              path.join(root, 'app/tsconfig.json'),
            ),
          ).toBe(true);
          expect(
            stats!.compilation.fileDependencies.has(
              path.join(root, 'lib/index.ts'),
            ),
          ).toBe(true);
          states.push(stats!.hasErrors());
          if (stats!.hasErrors()) {
            expect(stats!.toString({ all: false, errors: true })).toContain(
              'TS2322',
            );
          }
          if (states.length === 3) {
            finished = true;
            clearTimeout(deadline);
            resolve();
            return;
          }
          const type = states.length === 1 ? 'string' : 'number';
          // The result callback precedes watcher registration; await its actual handle.
          const writeWhenWatching = () => {
            pendingWrite = undefined;
            if (finished) return;
            if (!watch?.watcher) {
              pendingWrite = setImmediate(writeWhenWatching);
              return;
            }
            try {
              fs.writeFileSync(
                path.join(root, 'lib/index.ts'),
                `export interface Value { name: ${type} }`,
              );
            } catch (cause) {
              fail(cause);
            }
          };
          pendingWrite = setImmediate(writeWhenWatching);
        } catch (cause) {
          fail(cause);
        }
      });
    });
    expect(states).toEqual([true, false, true]);
  } finally {
    finished = true;
    clearTimeout(deadline);
    clearImmediate(pendingWrite);
    try {
      if (watch) {
        await new Promise<void>((resolve, reject) =>
          watch!.close((error?: Error | null) =>
            error ? reject(error) : resolve(),
          ),
        );
      }
    } finally {
      try {
        await new Promise<void>((resolve, reject) =>
          compiler.close(error => (error ? reject(error) : resolve())),
        );
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  }
}, 20000);
