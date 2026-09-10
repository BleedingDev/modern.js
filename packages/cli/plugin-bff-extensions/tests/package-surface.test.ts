import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type ExportConditions = {
  types: string;
  'modern:source'?: string;
  node: {
    'modern:source'?: string;
    import: string;
    require: string;
  };
  import?: string;
  default?: string;
};

type PackageManifest = {
  bugs: string;
  dependencies: Record<string, string>;
  description: string;
  devDependencies: Record<string, string>;
  engines: Record<string, string>;
  exports: Record<string, ExportConditions | string>;
  files: string[];
  homepage: string;
  keywords: string[];
  main?: string;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
  publishConfig: Record<string, string>;
  repository: {
    directory: string;
    type: string;
    url: string;
  };
  scripts: Record<string, string>;
  sideEffects: boolean;
  types?: string;
  typesVersions: Record<string, Record<string, string[]>>;
};

const packageRoot = path.resolve(__dirname, '..');
const requireCjs = createRequire(import.meta.url);
const packageManifest = JSON.parse(
  readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
) as PackageManifest;

const sourceLoaders = {
  './hono': {
    target: './src/hono/index.ts',
    load: () => import('../src/hono'),
  },
  './cross-project-policy': {
    target: './src/cross-project-policy/index.ts',
    load: () => import('../src/cross-project-policy'),
  },
  './cross-project-generation': {
    target: './src/cross-project-generation/index.ts',
    load: () => import('../src/cross-project-generation'),
  },
  './effect-adapter': {
    target: './src/effect-adapter/index.ts',
    load: () => import('../src/effect-adapter'),
  },
  './effect-source-loader': {
    target: './src/effect-source-loader/index.ts',
    load: () => import('../src/effect-source-loader'),
  },

  './backend-federation': {
    target: './src/backend-federation/index.ts',
    load: () => import('../src/backend-federation'),
  },
  './backend-federation/edge': {
    target: './src/backend-federation/edge.ts',
    load: () => import('../src/backend-federation/edge'),
  },
  './backend-federation/node': {
    target: './src/backend-federation/node.ts',
    load: () => import('../src/backend-federation/node'),
  },
  './backend-federation-manifest': {
    target: './src/backend-federation-manifest/index.ts',
    load: () => import('../src/backend-federation-manifest'),
  },
  './backend-federation-manifest/node': {
    target: './src/backend-federation-manifest/node.ts',
    load: () => import('../src/backend-federation-manifest/node'),
  },
  './effect-source-loader/rspack-loader': {
    target: './src/effect-source-loader/rspack-loader.ts',
    load: () => import('../src/effect-source-loader/rspack-loader'),
  },
  './producer-runtime': {
    target: './src/cross-project-policy/producer-runtime.ts',
    load: () => import('../src/cross-project-policy/producer-runtime'),
  },
  './hono/node': {
    target: './src/hono/node.ts',
    load: () => import('../src/hono/node'),
  },
} as const;

const publicSubpaths = Object.keys(sourceLoaders) as Array<
  keyof typeof sourceLoaders
>;
const webSubpaths = new Set<keyof typeof sourceLoaders>([
  './hono',
  './backend-federation',
  './backend-federation/edge',
  './producer-runtime',
]);

function conditionsFor(subpath: keyof typeof sourceLoaders) {
  return packageManifest.exports[subpath] as ExportConditions;
}

function expectLoadedNamespace(value: unknown, label: string) {
  const isCallable = typeof value === 'function';
  const hasExports =
    typeof value === 'object' &&
    value !== null &&
    Reflect.ownKeys(value).some(key => key !== '__esModule');
  expect(isCallable || hasExports, `${label} must expose a public API`).toBe(
    true,
  );
}

describe('@modern-js/plugin-bff-extensions package surface', () => {
  test('loads built Hono exports without resolving optional Effect peers', () => {
    const conditions = conditionsFor('./hono');
    const esmEntries = [conditions.node.import, conditions.import].map(
      entry => pathToFileURL(path.resolve(packageRoot, entry!)).href,
    );
    const cjsEntries = [path.resolve(packageRoot, conditions.node.require)];
    const script = `
      import { createRequire, registerHooks } from 'node:module';

      const optionalEffectPeers = ['effect', '@effect/opentelemetry'];
      registerHooks({
        resolve(specifier, context, nextResolve) {
          const forbiddenPeer = optionalEffectPeers.find(
            peer => specifier === peer || specifier.startsWith(peer + '/'),
          );
          if (forbiddenPeer) {
            throw new Error('built Hono surface resolved optional peer: ' + specifier);
          }
          return nextResolve(specifier, context);
        },
      });

      for (const entry of ${JSON.stringify(esmEntries)}) {
        await import(entry);
      }

      const require = createRequire(import.meta.url);
      for (const entry of ${JSON.stringify(cjsEntries)}) {
        require(entry);
      }
    `;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', script],
      {
        cwd: packageRoot,
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.signal).toBeNull();
  });

  test('loads every declared CJS, ESM, and modern:source export', async () => {
    expect(Object.keys(packageManifest.exports).sort()).toEqual(
      ['./package.json', ...publicSubpaths].sort(),
    );

    for (const subpath of publicSubpaths) {
      const conditions = conditionsFor(subpath);
      const source = sourceLoaders[subpath];
      const sourceTarget =
        conditions['modern:source'] ?? conditions.node['modern:source'];
      expect(sourceTarget).toBe(source.target);
      if (subpath === './hono/node') {
        expect(conditions['modern:source']).toBeUndefined();
        expect(conditions.default).toBeUndefined();
        expect(conditions.node['modern:source']).toBe('./src/hono/node.ts');
      }
      expect(existsSync(path.resolve(packageRoot, conditions.types))).toBe(
        true,
      );
      const typeVersionKey = subpath === '.' ? '.' : subpath.slice(2);
      expect(packageManifest.typesVersions['*'][typeVersionKey]).toEqual([
        conditions.types,
        sourceTarget,
      ]);
      expect(conditions.import !== undefined).toBe(webSubpaths.has(subpath));

      expectLoadedNamespace(
        await source.load(),
        `${subpath} modern:source export`,
      );
      expectLoadedNamespace(
        requireCjs(path.resolve(packageRoot, conditions.node.require)),
        `${subpath} CJS export`,
      );
      expectLoadedNamespace(
        await import(
          pathToFileURL(path.resolve(packageRoot, conditions.node.import)).href
        ),
        `${subpath} Node ESM export`,
      );

      if (conditions.import) {
        expectLoadedNamespace(
          await import(
            pathToFileURL(path.resolve(packageRoot, conditions.import)).href
          ),
          `${subpath} web ESM export`,
        );
      }
    }
  });

  test('dry-run pack includes product files and excludes internal surfaces', () => {
    const result = spawnSync('pnpm', ['pack', '--dry-run', '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);

    const report = JSON.parse(result.stdout) as {
      files: Array<{ path: string }>;
    };
    const packedPaths = report.files.map(file => file.path);
    expect(packedPaths.some(file => file.startsWith('dist/'))).toBe(true);
    expect(packedPaths.some(file => file.startsWith('src/'))).toBe(true);
    expect(packedPaths).toContain('package.json');
    expect(packedPaths.some(file => file.includes('adapter-kit'))).toBe(false);

    const allowedRootFiles = new Set(['LICENSE', 'README.md', 'package.json']);
    for (const packedPath of packedPaths) {
      expect(
        packedPath.startsWith('dist/') ||
          packedPath.startsWith('src/') ||
          allowedRootFiles.has(packedPath),
        `unexpected non-product file in package: ${packedPath}`,
      ).toBe(true);
    }
  });
});
