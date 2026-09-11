import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function resolveTsgoBin(): string {
  const packageJsonPath = require.resolve(
    '@typescript/native-preview/package.json',
  );
  const packageDirectory = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    bin?: string | { tsgo?: string };
  };
  const binEntry =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.tsgo;

  return path.resolve(packageDirectory, binEntry ?? 'bin/tsgo.js');
}

function runTsgo(tsgoBin: string, configPath: string): void {
  try {
    execFileSync(process.execPath, [tsgoBin, '-p', configPath], {
      stdio: 'pipe',
    });
  } catch (error) {
    const result = error as { stderr?: Buffer; stdout?: Buffer };
    throw new Error(
      `TS-Go compatibility check failed:\n${String(result.stdout ?? '')}${String(
        result.stderr ?? '',
      )}`,
    );
  }
}

describe('runtime router compatibility', () => {
  it('emits declarations compatible with the oldest runtime router shape', () => {
    const packageRoot = path.resolve(__dirname, '../..');
    const sourcePath = path.join(packageRoot, 'src/runtime/router.ts');
    const legacyFixturePath = path.join(
      __dirname,
      'fixtures/legacyRuntimeRouter.ts',
    );
    const tempRoot = mkdtempSync(
      path.join(tmpdir(), 'plugin-tanstack-router-compatibility-'),
    );
    const sourceRoot = path.join(tempRoot, 'src');
    const emittedRoot = path.join(tempRoot, 'types');
    const tsgoBin = resolveTsgoBin();

    try {
      mkdirSync(sourceRoot, { recursive: true });
      writeFileSync(
        path.join(sourceRoot, 'router.ts'),
        readFileSync(sourcePath, 'utf8'),
      );
      writeFileSync(
        path.join(sourceRoot, 'register.ts'),
        [
          'export declare const tanstackRouterProviderFactory:',
          '  (userConfig?: Record<string, unknown>) => { name?: string };',
        ].join('\n'),
      );
      writeFileSync(
        path.join(tempRoot, 'currentRuntimeRouter.d.ts'),
        [
          'export type RouterPluginFactory =',
          '  (userConfig?: Record<string, unknown>) => { name?: string };',
          'export declare const routerPlugin: RouterPluginFactory;',
          'export declare const createRouterPlugin:',
          '  (providers: readonly unknown[]) => RouterPluginFactory;',
        ].join('\n'),
      );
      writeFileSync(
        path.join(tempRoot, 'emit.json'),
        JSON.stringify(
          {
            compilerOptions: {
              declaration: true,
              emitDeclarationOnly: true,
              module: 'Preserve',
              moduleResolution: 'Bundler',
              noCheck: true,
              outDir: emittedRoot,
              paths: {
                '@modern-js/runtime/router/internal': [
                  './currentRuntimeRouter.d.ts',
                ],
              },
              rootDir: sourceRoot,
              skipLibCheck: false,
              strict: true,
              target: 'ESNext',
              types: [],
            },
            files: [path.join(sourceRoot, 'router.ts')],
          },
          null,
          2,
        ),
      );

      runTsgo(tsgoBin, path.join(tempRoot, 'emit.json'));

      const declarationPath = path.join(emittedRoot, 'router.d.ts');
      writeFileSync(
        path.join(tempRoot, 'legacyRuntimeRouter.ts'),
        readFileSync(legacyFixturePath, 'utf8'),
      );
      writeFileSync(
        path.join(tempRoot, 'compatibility.json'),
        JSON.stringify(
          {
            compilerOptions: {
              module: 'Preserve',
              moduleResolution: 'Bundler',
              noEmit: true,
              paths: {
                '@modern-js/runtime/router/internal': [
                  './legacyRuntimeRouter.ts',
                ],
              },
              skipLibCheck: false,
              strict: true,
              target: 'ESNext',
              types: [],
            },
            files: [
              declarationPath,
              path.join(tempRoot, 'legacyRuntimeRouter.ts'),
            ],
          },
          null,
          2,
        ),
      );

      runTsgo(tsgoBin, path.join(tempRoot, 'compatibility.json'));
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it('keeps "tanstack" resolvable for older wrappers that look providers up by name', async () => {
    // Older @modern-js/runtime copies resolve `router.framework: 'tanstack'`
    // through the global compatibility registry instead of an app-owned realm,
    // so importing the runtime entry must still register the provider.
    const { resolveRouterProvider } = await import(
      '@modern-js/runtime-extensions/router-provider'
    );
    await import('../../src/runtime/register');

    const factory = resolveRouterProvider('tanstack');
    expect(factory).toBeTypeOf('function');
    expect(factory?.({})?.setup).toBeTypeOf('function');
  });
});
