import { CHUNK_CSS_PLACEHOLDER } from '../../../../src/core/server/constants';
import { buildShellBeforeTemplate } from '../../../../src/core/server/stream/beforeTemplate';
import { buildShellBeforeTemplate as buildWorkerShellBeforeTemplate } from '../../../../src/core/server/stream/beforeTemplate.worker';

describe('buildShellBeforeTemplate', () => {
  it('should inject entry css when route matching context is unavailable', async () => {
    const html = await buildShellBeforeTemplate(
      `<html><head>${CHUNK_CSS_PLACEHOLDER}</head><body></body></html>`,
      {
        entryName: 'index',
        runtimeContext: {
          routeManifest: {
            routeAssets: {
              'async-index': {
                referenceCssAssets: ['/assets/async-index.css'],
              },
            },
          },
        } as any,
        config: {} as any,
      },
    );

    expect(html).toContain('/assets/async-index.css');
  });

  it('should inject entry css in worker stream SSR when route matching context is unavailable', async () => {
    const html = await buildWorkerShellBeforeTemplate(
      `<html><head>${CHUNK_CSS_PLACEHOLDER}</head><body></body></html>`,
      {
        entryName: 'index',
        runtimeContext: {
          routeManifest: {
            routeAssets: {
              'async-index': {
                referenceCssAssets: ['/assets/async-index.css'],
              },
            },
          },
        } as any,
        config: {} as any,
      },
    );

    expect(html).toContain('/assets/async-index.css');
  });

  it.each([
    [
      'a prefetch link',
      '<link href="/assets/async-index.css" rel="prefetch" />',
    ],
    [
      'a preload link',
      '<link href="/assets/async-index.css" rel="preload" as="style" />',
    ],
    ['unrelated text', '<meta content="/assets/async-index.css" />'],
    [
      'a stylesheet link with a longer URL',
      '<link href="/assets/async-index.css?v=1" rel="stylesheet" />',
    ],
    [
      'the exact stylesheet link',
      '<link href="/assets/async-index.css" rel="stylesheet" />',
    ],
  ])('should preserve exactly one worker stylesheet when the template contains %s', async (_description, existingMarkup) => {
    const stylesheet =
      '<link href="/assets/async-index.css" rel="stylesheet" />';
    const html = await buildWorkerShellBeforeTemplate(
      `<html><head>${existingMarkup}${CHUNK_CSS_PLACEHOLDER}</head><body></body></html>`,
      {
        entryName: 'index',
        runtimeContext: {
          routeManifest: {
            routeAssets: {
              'async-index': {
                referenceCssAssets: ['/assets/async-index.css'],
              },
            },
          },
        } as any,
        config: {} as any,
      },
    );

    expect(html.split(stylesheet)).toHaveLength(2);
  });
});
