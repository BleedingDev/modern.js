import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rspack } from '@rsbuild/core';
import { UltramodernNativeTypeChecker } from '../src/native-type-checker';

const require = createRequire(import.meta.url);
// The package bin is a Node.js launcher; use its own resolver for the Go executable.
const { default: getExePath } = await import(
  pathToFileURL(
    path.join(
      path.dirname(require.resolve('@typescript/native-preview/package.json')),
      'lib/getExePath.js',
    ),
  ).href
);
const compiler: string = getExePath();

test('checks and rebuilds referenced projects without overriding their emit contracts', async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'native-reference-check-'),
  );
  const write = (file: string, value: string | object) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  };
  try {
    const compilerOptions = {
      composite: true,
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
      strict: true,
      types: [],
    };
    write('lib/tsconfig.json', { compilerOptions, files: ['index.ts'] });
    write('lib/index.ts', 'export interface Value { name: string }');
    write('app/tsconfig.json', {
      compilerOptions,
      references: [{ path: '../lib' }],
      files: ['index.ts'],
    });
    write(
      'app/index.ts',
      "import type { Value } from '../lib'; export const item: Value = { name: 'ok' };",
    );
    write('tsconfig.json', { files: [], references: [{ path: './app' }] });
    const checker = new UltramodernNativeTypeChecker({
      build: true,
      compiler: () => compiler,
      configFile: path.join(root, 'tsconfig.json'),
    });
    await checker.check();
    expect(fs.existsSync(path.join(root, 'lib/index.d.ts'))).toBe(true);
    write('lib/index.ts', 'export interface Value { name: number }');
    await expect(checker.check()).rejects.toThrow('TS2322');
    write('lib/index.ts', 'export interface Value { name: string }');
    await checker.check();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ordinary project checks emit nothing and surface compiler startup failures', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-project-check-'));
  try {
    fs.writeFileSync(path.join(root, 'index.ts'), 'export const value = 1;');
    fs.writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { types: [] }, files: ['index.ts'] }),
    );
    const options = {
      build: false,
      compiler: () => compiler,
      configFile: path.join(root, 'tsconfig.json'),
    };
    await new UltramodernNativeTypeChecker(options).check();
    expect(fs.existsSync(path.join(root, 'index.js'))).toBe(false);
    await expect(
      new UltramodernNativeTypeChecker({
        ...options,
        compiler: () => path.join(root, 'missing'),
      }).check(),
    ).rejects.toThrow(/UltramodernNativeTypeChecker failed:\n.*ENOENT/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the rspack plugin reports type errors as build errors and registers referenced type-only inputs', async () => {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'native-plugin-check-')),
  );
  const compilerOptions = {
    composite: true,
    declaration: true,
    emitDeclarationOnly: true,
    noEmit: false,
    types: [],
  };
  for (const [relative, value] of Object.entries({
    'lib/index.ts': 'export interface Value { name: number }',
    'lib/tsconfig.json': JSON.stringify({
      compilerOptions,
      files: ['index.ts'],
    }),
    'app/index.ts':
      "import type { Value } from '../lib'; export const item: Value = { name: 'ok' };",
    'app/tsconfig.json': JSON.stringify({
      compilerOptions,
      files: ['index.ts'],
      references: [{ path: '../lib' }],
    }),
  })) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  }
  const build = rspack({
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
        compiler: () => compiler,
      }),
    ],
  });
  try {
    const stats = await new Promise<any>((resolve, reject) =>
      build.run((error, result) => (error ? reject(error) : resolve(result))),
    );
    expect(stats.toString({ all: false, errors: true })).toContain('TS2322');
    // Type-only inputs are outside the module graph; watch rebuilds only if they are registered.
    expect(
      stats.compilation.fileDependencies.has(path.join(root, 'lib/index.ts')),
    ).toBe(true);
    expect(
      stats.compilation.fileDependencies.has(
        path.join(root, 'app/tsconfig.json'),
      ),
    ).toBe(true);
  } finally {
    await new Promise<void>((resolve, reject) =>
      build.close(error => (error ? reject(error) : resolve())),
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30000);
