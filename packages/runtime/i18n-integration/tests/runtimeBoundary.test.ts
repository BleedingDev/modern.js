import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, test } from '@rstest/core';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);

describe('combined runtime optional integration boundary', () => {
  test.each([
    'node',
    'browser',
  ] as const)('no-react %s bundle never reaches the default native entry or optional React integration', async platform => {
    const result = await build({
      entryPoints: [resolve(__dirname, '../src/runtime-no-react-i18next.ts')],
      bundle: true,
      packages: 'external',
      platform,
      format: 'esm',
      metafile: true,
      write: false,
      plugins: [
        {
          name: 'follow-public-native-i18n',
          setup(api) {
            api.onResolve({ filter: /^react-i18next(?:\/|$)/ }, () => {
              throw new Error('no-react runtime reached react-i18next');
            });
            api.onResolve(
              { filter: /^@modern-js\/plugin-i18n\/runtime$/ },
              () => {
                throw new Error(
                  'no-react runtime reached the default native runtime',
                );
              },
            );
            api.onResolve(
              { filter: /^@modern-js\/plugin-i18n\/runtime\// },
              args => ({ path: require.resolve(args.path) }),
            );
          },
        },
      ],
    });
    expect(
      Object.keys(result.metafile!.inputs).some(path =>
        path.includes('runtime-no-react-i18next'),
      ),
    ).toBe(true);
  });
});

test.each([
  'node',
  'browser',
] as const)('native %s runtime has no fork engine dependency', async platform => {
  const result = await build({
    entryPoints: [
      require.resolve('@modern-js/plugin-i18n/runtime/no-react-i18next'),
    ],
    bundle: true,
    packages: 'external',
    platform,
    format: 'esm',
    metafile: true,
    write: false,
    plugins: [
      {
        name: 'reject-native-fork-engine-edge',
        setup(api) {
          api.onResolve(
            { filter: /^@modern-js\/i18n-runtime-extensions(?:\/|$)/ },
            () => {
              throw new Error('native runtime imports fork i18n engine');
            },
          );
        },
      },
    ],
  });
  expect(Object.keys(result.metafile!.inputs).length).toBeGreaterThan(0);
});
