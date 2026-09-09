import { SSR_HYDRATION_ID_PREFIX } from '@modern-js/utils/universal/constants';
import { type ReactElement, Suspense, useId } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from '../../../src/core/browser/hydrate';
import { getInitialContext } from '../../../src/core/context/runtime';
import { createRenderStreaming } from '../../../src/core/server/stream/shared';

function LabelledInput() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Name</label>
      <input id={id} />
    </>
  );
}

describe('streaming SSR hydration tree', () => {
  afterEach(() => {
    rstest.unstubAllGlobals();
  });

  test('preserves React-generated IDs and label targets during hydration', async () => {
    const App = (
      <Suspense fallback={null}>
        <LabelledInput />
        <LabelledInput />
      </Suspense>
    );
    let serverHtml = '';
    const renderStreaming = createRenderStreaming(
      Promise.resolve(async (_request, rootElement) => {
        serverHtml = renderToString(rootElement, {
          identifierPrefix: SSR_HYDRATION_ID_PREFIX,
        });
        return new ReadableStream({
          start(controller) {
            controller.close();
          },
        });
      }),
    );
    await renderStreaming(new Request('http://localhost/'), App, {
      config: { ssr: { mode: 'stream' } },
      resource: { entryName: 'main', htmlTemplate: '' },
      runtimeContext: getInitialContext(false),
      onTiming: rstest.fn(),
      onError: rstest.fn(),
    } as Parameters<typeof renderStreaming>[2]);

    rstest.stubGlobal('window', {
      _SSR_DATA: { mode: 'stream', renderLevel: 2 },
    });
    let hydrationHtml = '';
    await hydrateRoot(
      App,
      getInitialContext(true),
      rstest.fn(),
      async (rootElement: ReactElement) => {
        hydrationHtml = renderToString(rootElement, {
          identifierPrefix: SSR_HYDRATION_ID_PREFIX,
        });
        return {} as HTMLElement;
      },
    );

    const attributes = (html: string) => html.match(/(?:id|for)="[^"]+"/g);
    expect(attributes(serverHtml)).toHaveLength(4);
    expect(attributes(hydrationHtml)).toEqual(attributes(serverHtml));
  });
});
