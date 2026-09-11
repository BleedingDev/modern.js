import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, test } from '@rstest/core';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);

describe('combined runtime optional integration boundary', () => {
  test('no-react node bundle never reaches the default native entry or optional React integration', async () => {
    await build({
      entryPoints: [resolve(__dirname, '../src/runtime-no-react-i18next.ts')],
      bundle: true,
      packages: 'external',
      platform: 'node',
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
  });
});

/*
 * A second assertion here used to require that the native runtime never import
 * `@modern-js/i18n-runtime-extensions`, keeping the fork's URL engine out of
 * the client bundle while mapped locale URLs were opt-in.
 *
 * Mapped locale URLs are now default-on for a bare `appTools()` consumer, so
 * the client has to localize pathnames too, from the same module the server
 * uses. The invariant that actually protects users is not "no import edge" but
 * "the client and the server agree": if they disagree, SSR renders
 * `/cs/obchodni-podminky` while the hydrated `<Link>` navigates to
 * `/cs/terms-of-service`, which 404s. Sharing one implementation is what makes
 * that impossible; duplicating ~500 lines of pattern matching into the native
 * package to preserve the old import edge would reintroduce exactly the drift
 * the assertion meant to prevent. The behaviour is covered by
 * `plugin-i18n/tests/mappedUrlStrategyDerivation.test.ts`.
 */
