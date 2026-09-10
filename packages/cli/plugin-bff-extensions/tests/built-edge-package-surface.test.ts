import path from 'node:path';
import { build } from 'esbuild';

const packageRoot = path.resolve(__dirname, '..');

async function bundlePublicExport(specifiers: readonly string[]) {
  return build({
    absWorkingDir: packageRoot,
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    metafile: true,
    platform: 'browser',
    stdin: {
      contents: specifiers
        .map(specifier => `export * from ${JSON.stringify(specifier)};`)
        .join('\n'),
      loader: 'js',
      resolveDir: path.join(packageRoot, 'tests'),
      sourcefile: 'built-public-export.mjs',
    },
    target: 'es2022',
    treeShaking: true,
    write: false,
  });
}

const publicEdgeExports = [
  {
    forbiddenPackageCones: [],
    label: 'Effect edge and federation edge consumer',
    specifiers: [
      '@modern-js/bff-effect/effect-edge',
      '@modern-js/plugin-bff-extensions/backend-federation/edge',
    ],
  },
  {
    forbiddenPackageCones: [],
    label: 'Effect edge dispatcher',
    specifiers: ['@modern-js/bff-effect/effect-edge'],
  },
  {
    forbiddenPackageCones: [
      /\/node_modules\/(?:@effect|effect)\//u,
      /\/backend-federation(?:\/|$)/u,
      /\/node_modules\/@module-federation\//u,
    ],
    label: 'Hono route binding',
    specifiers: ['@modern-js/plugin-bff-extensions/hono'],
  },
] as const;

describe('built edge package surfaces', () => {
  test.each(
    publicEdgeExports,
  )('bundles $label through its published exports', async ({
    forbiddenPackageCones,
    specifiers,
  }) => {
    const result = await bundlePublicExport(specifiers);
    const inputs = Object.keys(result.metafile.inputs).map(input =>
      path.resolve(packageRoot, input).replaceAll('\\', '/'),
    );

    expect(
      inputs.filter(input =>
        [
          path.join(packageRoot, 'src'),
          path.resolve(packageRoot, '../../server/bff-effect/src'),
        ].some(sourceRoot =>
          input.startsWith(sourceRoot.replaceAll('\\', '/')),
        ),
      ),
    ).toEqual([]);

    for (const forbiddenCone of forbiddenPackageCones) {
      expect(inputs).not.toEqual(
        expect.arrayContaining([expect.stringMatching(forbiddenCone)]),
      );
    }
    expect(
      inputs.filter(
        input =>
          input.includes('/adapter-kit/') ||
          input.includes('/backend-federation-security/node'),
      ),
    ).toEqual([]);

    const outputImports = Object.values(result.metafile.outputs).flatMap(
      output => output.imports,
    );
    expect(outputImports).toEqual([]);
  });
});
