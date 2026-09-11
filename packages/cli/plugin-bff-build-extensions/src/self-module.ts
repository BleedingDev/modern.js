import { createRequire } from 'node:module';

const selfRequire = createRequire(import.meta.url);

/**
 * Resolve a file this package ships alongside the calling module.
 *
 * Resolving it by this package's own public name (`@modern-js/plugin-bff-build-extensions/<name>`)
 * only works where the package can see itself in a `node_modules` directory —
 * under pnpm's isolated layout it is anchored in its own `.pnpm` directory and
 * the lookup fails for a consumer, surfacing as an opaque `require.resolve`
 * error in the middle of a build. A sibling lookup works in every layout:
 * source (`src/*.ts`), CommonJS (`dist/cjs/*.js`) and ESM (`dist/esm-node/*.mjs`)
 * all place these files next to each other.
 */
export const resolveSelfModule = (name: string): string => {
  for (const extension of ['.js', '.mjs', '.cjs', '.ts']) {
    try {
      return selfRequire.resolve(`./${name}${extension}`);
    } catch {
      // Try the next extension this package may have been built with.
    }
  }
  // A layout that hoists this package still resolves the public specifier.
  return selfRequire.resolve(`@modern-js/plugin-bff-build-extensions/${name}`);
};
