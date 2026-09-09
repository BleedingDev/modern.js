import { RenderLevel } from '../../../src/core/constants';
import { LoadableCollector } from '../../../src/core/server/string/loadable';

const chunk = (url: string, filename = url) => ({
  url,
  filename,
  path: url,
});

describe('LoadableCollector native assets', () => {
  it('does not re-emit async assets represented by the entry manifest', async () => {
    const chunkSet = {
      renderLevel: RenderLevel.CLIENT_RENDER,
      ssrScripts: '',
      jsChunk: '',
      cssChunk: '',
    };
    const collector = new LoadableCollector({
      template: '<html><head></head><body></body></html>',
      entryName: 'index',
      chunkSet,
      config: {
        enableAsyncEntry: true,
      },
      routeManifest: {
        routeAssets: {
          index: {
            assets: [
              '/static/js/async/async-index.js',
              '/static/css/async/async-index.css',
            ],
          },
        },
      },
    });

    (collector as any).extractor = {
      chunks: [],
      getChunkAssets: (chunks: string[]) =>
        chunks.includes('async-index')
          ? [
              chunk('/static/js/async/async-index.js'),
              chunk('/static/css/async/async-index.css'),
            ]
          : [],
      getScriptTags: () => '',
    };

    await collector.effect();

    expect(chunkSet.jsChunk).toBe('');
    expect(chunkSet.cssChunk).toBe('');
  });
});
