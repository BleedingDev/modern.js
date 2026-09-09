import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  type BuilderInstance,
  createBuilder,
} from '../../packages/cli/builder/src';

type BundlerConfig = Awaited<
  ReturnType<BuilderInstance['initConfigs']>
>[number];
const builderRequire = createRequire(
  new URL('../../packages/cli/builder/package.json', import.meta.url),
);

export function assertPersistentCache(cache: BundlerConfig['cache']) {
  assert.ok(cache && typeof cache === 'object' && cache.type === 'persistent');
  assert.equal(cache.storage?.type, 'filesystem');
  assert.ok(cache.buildDependencies?.includes('modern.config.ts'));
}

/** Exercise the builder's cache configuration with cold and restored compilers. */
export async function assertCacheIsolation(configs: BundlerConfig[]) {
  const { rspack } = await import(builderRequire.resolve('@rsbuild/core'));
  const sandbox = await mkdtemp(join(tmpdir(), 'modern-builder-cache-'));
  try {
    const entry = join(sandbox, 'entry.js');
    await writeFile(entry, 'globalThis.builderCacheValue = BUILDER_ENV;\n');
    // inspectConfig accepts a nonexistent framework config; a build needs a
    // real dependency so the second compiler can restore its persistent cache.
    const frameworkConfig = join(sandbox, 'modern.config.ts');
    await writeFile(frameworkConfig, 'export default {};\n');
    for (const pass of ['cold', 'warm']) {
      const compiler = rspack(
        configs.map(config => {
          const cache = config.cache;
          assert.ok(
            cache && typeof cache === 'object' && cache.type === 'persistent',
          );
          return {
            ...config,
            entry: { main: entry },
            cache: {
              ...cache,
              buildDependencies: cache.buildDependencies?.map(
                (dependency: string) =>
                  dependency === 'modern.config.ts'
                    ? frameworkConfig
                    : dependency,
              ),
              storage: {
                type: 'filesystem',
                directory: join(sandbox, 'cache'),
              },
            },
            output: {
              ...config.output,
              path: join(sandbox, String(config.name)),
              filename: '[name].js',
            },
            plugins: [
              ...(config.plugins ?? []),
              new rspack.DefinePlugin({
                BUILDER_ENV: JSON.stringify(config.name),
              }),
            ],
          };
        }),
      );
      try {
        const stats: any = await new Promise((resolve, reject) => {
          compiler.run((error: Error | null, result: any) => {
            if (error || result?.hasErrors()) {
              reject(error ?? new Error(result.toString()));
            } else {
              resolve(result);
            }
          });
        });
        const locations = compiler.compilers.map(
          (child: any) => child.options.cache.storage.location,
        );
        assert.equal(new Set(locations).size, configs.length);
        for (const [index, config] of configs.entries()) {
          const context = {
            globalThis: {},
            self: {},
            exports: {},
            module: { exports: {} },
          };
          const assets = stats.stats[index].toJson({
            all: false,
            entrypoints: true,
          }).entrypoints.main.assets;
          for (const asset of assets.filter((asset: any) =>
            asset.name.endsWith('.js'),
          )) {
            runInNewContext(
              await readFile(
                join(sandbox, String(config.name), asset.name),
                'utf8',
              ),
              context,
            );
          }
          assert.equal(
            (context.globalThis as { builderCacheValue?: string })
              .builderCacheValue,
            config.name,
            `${pass} cache output for ${config.name}`,
          );
          const entryModule = stats.stats[index]
            .toJson({ all: false, modules: true, cachedModules: true })
            .modules.find((module: any) =>
              module.nameForCondition?.endsWith('/entry.js'),
            );
          assert.ok(entryModule, `expected fixture entry for ${config.name}`);
          assert.equal(
            entryModule.built,
            pass === 'cold',
            `${pass} module restoration for ${config.name}`,
          );
        }
      } finally {
        await new Promise<void>((resolve, reject) =>
          compiler.close((error: Error | null) =>
            error ? reject(error) : resolve(),
          ),
        );
      }
      await Promise.all(
        configs.map(config =>
          rm(join(sandbox, String(config.name)), {
            recursive: true,
            force: true,
          }),
        ),
      );
    }
    const compiler = rspack(configs);
    try {
      return compiler.compilers.map(
        (child: any) => child.options,
      ) as BundlerConfig[];
    } finally {
      await new Promise<void>((resolve, reject) =>
        compiler.close((error: Error | null) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

/** A deployed Node bundle must resolve createRequire dependencies without source. */
export async function assertCreateRequireBundling() {
  const sandbox = await mkdtemp(join(tmpdir(), 'modern-builder-require-'));
  try {
    for (const explicitFalse of [false, true]) {
      const appRoot = join(sandbox, explicitFalse ? 'override' : 'default');
      await mkdir(appRoot);
      const entry = join(appRoot, 'entry.mjs');
      const dependency = join(appRoot, 'answer.cjs');
      const output = join(appRoot, 'dist');
      await writeFile(
        entry,
        "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconsole.log(require('./answer.cjs'));\n",
      );
      await writeFile(
        dependency,
        "module.exports = 'bundled-relative-answer';\n",
      );
      const builder = await createBuilder({
        bundlerType: 'rspack',
        cwd: appRoot,
        config: {
          source: { entry: { main: entry } },
          environments: {
            server: {
              output: {
                target: 'node',
                distPath: { root: output },
                filename: { js: '[name].cjs' },
              },
            },
          },
          ...(explicitFalse
            ? {
                tools: {
                  rspack: {
                    module: {
                      parser: { javascript: { createRequire: false } },
                    },
                  },
                },
              }
            : {}),
        },
      });
      const {
        origin: { bundlerConfigs },
      } = await builder.inspectConfig();
      assert.equal(
        bundlerConfigs[0].module?.parser?.javascript?.createRequire,
        !explicitFalse,
      );
      await builder.build();
      await Promise.all([rm(entry), rm(dependency)]);
      const result = spawnSync(process.execPath, [join(output, 'main.cjs')], {
        encoding: 'utf8',
      });
      assert.ifError(result.error);
      if (explicitFalse) {
        assert.notEqual(result.status, 0);
        assert.match(
          result.stderr,
          /Cannot find module ['"]\.\/answer\.cjs['"]/,
        );
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), 'bundled-relative-answer');
      }
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}
