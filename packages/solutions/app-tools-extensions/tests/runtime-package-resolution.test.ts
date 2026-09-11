import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from '@rstest/core';
import {
  canResolveRuntimePackage,
  collectRuntimePackageModuleDirectories,
  createRuntimePackageResolutionPlugin,
  findHostingModuleDirectory,
} from '../src/runtime-package-resolution';

const registrarUrl = pathToFileURL(
  path.join(__dirname, '../src/runtime-package-resolution.ts'),
).href;

describe('runtime package resolution', () => {
  test('finds the node_modules directory that actually hosts the package', () => {
    const directory = findHostingModuleDirectory(
      '@modern-js/server-runtime-extensions',
      path.join(__dirname, '../src'),
    );

    expect(directory).toBeDefined();
    expect(
      fs.existsSync(
        path.join(directory!, '@modern-js/server-runtime-extensions'),
      ),
    ).toBe(true);
  });

  test('reports nothing for a package no ancestor hosts', () => {
    expect(
      findHostingModuleDirectory('@modern-js/not-a-real-package', __dirname),
    ).toBeUndefined();
  });

  test('collects one directory per registered package, deduplicated', () => {
    const directories = collectRuntimePackageModuleDirectories(
      [
        '@modern-js/server-runtime-extensions',
        '@modern-js/utils',
        '@modern-js/not-a-real-package',
      ],
      registrarUrl,
    );

    expect(directories.length).toBeGreaterThan(0);
    expect(new Set(directories).size).toBe(directories.length);
    for (const directory of directories) {
      expect(path.basename(directory)).toBe('node_modules');
    }
  });

  test('appends the directories without displacing the default search', () => {
    const plugin = createRuntimePackageResolutionPlugin(['/fallback/modules']);
    const configs: any[] = [{}, { resolve: { modules: ['node_modules'] } }];
    const handlers: Array<(input: any) => void> = [];

    plugin.setup({
      modifyRspackConfig: ({ handler }: any) => handlers.push(handler),
      onBeforeCreateCompiler: ({ handler }: any) =>
        handlers.push(() => handler({ bundlerConfigs: configs })),
    } as any);

    handlers[0](configs[0]);
    handlers[1]({});

    // The app's own upward `node_modules` search keeps priority.
    expect(configs[0].resolve.modules).toEqual([
      'node_modules',
      '/fallback/modules',
    ]);
    expect(configs[1].resolve.modules).toEqual([
      'node_modules',
      '/fallback/modules',
    ]);
  });

  test('never duplicates a directory already present', () => {
    const plugin = createRuntimePackageResolutionPlugin(['/fallback/modules']);
    const config: any = {
      resolve: { modules: ['node_modules', '/fallback/modules'] },
    };
    let handler: ((input: any) => void) | undefined;

    plugin.setup({
      modifyRspackConfig: (options: any) => {
        handler = options.handler;
      },
      onBeforeCreateCompiler: () => undefined,
    } as any);

    handler?.(config);

    expect(config.resolve.modules).toEqual([
      'node_modules',
      '/fallback/modules',
    ]);
  });

  test('reports whether a package resolves from the registrar at all', () => {
    expect(canResolveRuntimePackage('@modern-js/utils', registrarUrl)).toBe(
      true,
    );
    expect(
      canResolveRuntimePackage('@modern-js/not-a-real-package', registrarUrl),
    ).toBe(false);
  });
});
