import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const packageRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
);

const collectExportTargets = (
  value: unknown,
  conditions: string[] = [],
): Array<{ conditions: string[]; target: string }> => {
  if (typeof value === 'string') {
    return [{ conditions, target: value }];
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).flatMap(([condition, target]) =>
    collectExportTargets(target, [...conditions, condition]),
  );
};

describe('published package surface', () => {
  test('resolves public runtime conditions exclusively from dist', () => {
    expect(packageJson.exports['./server']).toEqual({
      types: './dist/types/runtime/hono/index.d.ts',
      node: {
        import: './dist/esm-node/runtime/hono/index.mjs',
        require: './dist/cjs/runtime/hono/index.js',
      },
      default: './dist/cjs/runtime/hono/index.js',
    });

    for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
      if (subpath === './package.json') {
        continue;
      }
      for (const {
        conditions: targetConditions,
        target,
      } of collectExportTargets(conditions)) {
        if (targetConditions.includes('modern:source')) {
          expect(subpath).toBe('./cross-project');
          expect(targetConditions).toEqual(['modern:source']);
          expect(target).toBe('./src/utils/crossProjectApiPlugin.ts');
        } else {
          expect(target, `${subpath} runtime and types must use dist`).toMatch(
            /^\.\/dist\//,
          );
        }
        expect(
          fs.existsSync(path.resolve(packageRoot, target)),
          `${subpath} target ${target} must exist in the published output`,
        ).toBe(true);
      }
    }
  });

  test('resolves cross-project runtime and explicit source conditions', async () => {
    const specifier = '@modern-js/plugin-bff/cross-project';
    for (const useSource of [false, true]) {
      const result = spawnSync(
        process.execPath,
        [
          ...(useSource ? ['--conditions=modern:source'] : []),
          '--input-type=module',
          '-e',
          `
            import { createRequire } from 'node:module';
            const require = createRequire(import.meta.url);
            const specifier = ${JSON.stringify(specifier)};
            const esm = await import(specifier);
            const cjs = require(specifier);
            const options = {
              packageName: 'surface-producer', prefix: '/api',
              relativeDistPath: 'dist', relativeApiPath: 'api',
              relativeLambdaPath: 'lambda',
            };
            process.stdout.write(JSON.stringify({
              esm: import.meta.resolve(specifier),
              cjs: require.resolve(specifier),
              plugins: [esm, cjs].map(namespace =>
                namespace.createCrossProjectApiPlugin(options).name),
            }));
          `,
        ],
        { cwd: packageRoot, encoding: 'utf8' },
      );
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.signal).toBeNull();
      expect(JSON.parse(result.stdout)).toEqual({
        esm: pathToFileURL(
          path.join(
            packageRoot,
            useSource
              ? 'src/utils/crossProjectApiPlugin.ts'
              : 'dist/esm-node/utils/crossProjectApiPlugin.mjs',
          ),
        ).href,
        cjs: path.join(
          packageRoot,
          useSource
            ? 'src/utils/crossProjectApiPlugin.ts'
            : 'dist/cjs/utils/crossProjectApiPlugin.js',
        ),
        plugins: [
          '@modern-js/plugin-independent-bff',
          '@modern-js/plugin-independent-bff',
        ],
      });

      const resolvedTargets: string[] = [];
      await build({
        stdin: { contents: '', resolveDir: packageRoot },
        platform: 'browser',
        conditions: useSource ? ['modern:source'] : [],
        write: false,
        plugins: [
          {
            name: 'verify-cross-project-condition-resolution',
            setup(builder) {
              builder.onStart(async () => {
                const resolved = await builder.resolve(specifier, {
                  kind: 'import-statement',
                  resolveDir: packageRoot,
                });
                expect(resolved.errors).toEqual([]);
                resolvedTargets.push(resolved.path);
              });
            },
          },
        ],
      });
      expect(resolvedTargets).toEqual([
        path.join(
          packageRoot,
          useSource
            ? 'src/utils/crossProjectApiPlugin.ts'
            : 'dist/cjs/utils/crossProjectApiPlugin.js',
        ),
      ]);
    }
  });

  test('requires the fork Node baseline', () => {
    expect(packageJson.engines).toEqual({ node: '>=26.7.0' });
  });

  test('maps the package root to its CLI declarations', () => {
    expect(packageJson.typesVersions['*']['.']).toEqual([
      './dist/types/cli.d.ts',
    ]);
  });

  test('keeps build-only tooling out of runtime dependencies', () => {
    expect({
      builderDependency: packageJson.dependencies['@modern-js/builder'],
      builderDevDependency: packageJson.devDependencies['@modern-js/builder'],
      esbuildDependency: packageJson.dependencies.esbuild,
      esbuildDevDependency: packageJson.devDependencies.esbuild,
    }).toEqual({
      builderDependency: undefined,
      builderDevDependency: 'workspace:*',
      esbuildDependency: undefined,
      esbuildDevDependency: '^0.28.2',
    });
  });

  test('declares the emitted CLI type dependency as an optional peer', () => {
    const appToolsPackage = JSON.parse(
      fs.readFileSync(
        path.resolve(packageRoot, '../../solutions/app-tools/package.json'),
        'utf8',
      ),
    );
    const cliDeclaration = fs.readFileSync(
      path.join(packageRoot, 'dist/types/cli.d.ts'),
      'utf8',
    );

    expect(cliDeclaration).toContain("from '@modern-js/app-tools'");
    expect({
      dependency: packageJson.dependencies['@modern-js/app-tools'],
      devDependency: packageJson.devDependencies['@modern-js/app-tools'],
      optional:
        packageJson.peerDependenciesMeta['@modern-js/app-tools']?.optional,
      peerDependency: packageJson.peerDependencies['@modern-js/app-tools'],
    }).toEqual({
      dependency: undefined,
      devDependency: 'workspace:*',
      optional: true,
      peerDependency: `workspace:^${appToolsPackage.version}`,
    });
  });
});
