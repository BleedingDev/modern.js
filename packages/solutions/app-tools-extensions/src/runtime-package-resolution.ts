import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

/**
 * A generated `runtime-register.js` lives inside the *application*, so every
 * runtime plugin it imports has to resolve from the application's own
 * `node_modules`. Packages registered by a CLI plugin are dependencies of that
 * CLI plugin, not of the application, and under an isolated (pnpm) linker the
 * application cannot see them — the build fails with `Module not found`.
 *
 * Instead of freezing a single resolved file (which would lock one export
 * condition and break the web/node split), the registering package contributes
 * the `node_modules` directory that actually hosts the package as a *fallback*
 * module directory. Bare specifiers keep their normal `exports` resolution, the
 * application's own copy still wins when it declares the dependency, and both
 * the workspace source layout and a published pnpm layout work.
 */
export const findHostingModuleDirectory = (
  packageName: string,
  fromDirectory: string,
): string | undefined => {
  let directory = path.resolve(fromDirectory);
  for (;;) {
    const candidate = path.join(directory, 'node_modules');
    if (fs.existsSync(path.join(candidate, packageName))) {
      return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
};

/**
 * Collect the fallback module directories for the given packages, starting the
 * search at the module that registers them.
 */
export const collectRuntimePackageModuleDirectories = (
  packageNames: readonly string[],
  registrarUrl: string,
): string[] => {
  const registrarDirectory = path.dirname(fileURLToPath(registrarUrl));
  const directories: string[] = [];
  for (const packageName of packageNames) {
    const directory = findHostingModuleDirectory(
      packageName,
      registrarDirectory,
    );
    if (directory && !directories.includes(directory)) {
      directories.push(directory);
    }
  }
  return directories;
};

const appendModuleDirectories = (
  config: Rspack.Configuration,
  directories: readonly string[],
) => {
  if (directories.length === 0) {
    return;
  }
  config.resolve ??= {};
  const existing = config.resolve.modules ?? ['node_modules'];
  // Appended, never prepended: the application's own upward `node_modules`
  // search keeps priority, so a declared dependency still wins.
  config.resolve.modules = [
    ...existing,
    ...directories.filter(directory => !existing.includes(directory)),
  ];
};

/**
 * Rsbuild plugin that adds the given directories as fallback module roots for
 * every environment (web, node and worker bundles alike).
 */
export const createRuntimePackageResolutionPlugin = (
  directories: readonly string[],
): RsbuildPlugin => ({
  name: 'ultramodern:runtime-package-resolution',
  setup(api) {
    api.modifyRspackConfig({
      order: 'post',
      handler(config) {
        appendModuleDirectories(config, directories);
      },
    });
    api.onBeforeCreateCompiler({
      order: 'post',
      handler({ bundlerConfigs }) {
        for (const config of bundlerConfigs) {
          appendModuleDirectories(config, directories);
        }
      },
    });
  },
});

/** `true` when the package resolves from the registering module at all. */
export const canResolveRuntimePackage = (
  packageName: string,
  registrarUrl: string,
): boolean => {
  try {
    createRequire(registrarUrl).resolve(packageName);
    return true;
  } catch {
    return false;
  }
};
