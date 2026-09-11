// @rstest-environment happy-dom

// Fork-owned coverage guard (FORK-DIVERGENCE.md: "Verify matching SSR/client
// useId tree paths and label targets"). Keeps the streaming-SSR hydration id
// case out of the upstream-owned tests/core/browser/hydrate.test.tsx.
import { SSR_HYDRATION_ID_PREFIX } from '@modern-js/utils/universal/constants';
import { type ReactElement, Suspense, useId } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from '../../../src/core/browser/hydrate';
import { getInitialContext } from '../../../src/core/context/runtime';
import { createRenderStreaming } from '../../../src/core/server/stream/shared';

// The stream hydrate path inserts an empty `{null}` sibling to mirror the SSR
// StreamServerRootWrapper end-marker. Drop it and React's useId tree paths
// diverge, so every streaming-SSR app hydrates with mismatched id/for pairs.
test('stream hydration tree keeps the server-generated ids', async () => {
  const Labelled = () => {
    const id = useId();
    return (
      <>
        <label htmlFor={id}>Name</label>
        <input id={id} />
      </>
    );
  };
  const tree = (
    <Suspense fallback={null}>
      <Labelled />
      <Labelled />
    </Suspense>
  );
  const render = (element: ReactElement) =>
    renderToString(element, { identifierPrefix: SSR_HYDRATION_ID_PREFIX });

  let serverHtml = '';
  await createRenderStreaming(
    Promise.resolve(async (_request, rootElement) => {
      serverHtml = render(rootElement);
      return new ReadableStream({ start: c => c.close() });
    }),
  )(new Request('http://localhost/'), tree, {
    config: { ssr: { mode: 'stream' } },
    resource: { entryName: 'main', htmlTemplate: '' },
    runtimeContext: getInitialContext(false),
    onTiming: rstest.fn(),
    onError: rstest.fn(),
  } as any);

  (window as any)._SSR_DATA = { mode: 'stream', renderLevel: 2 };
  let clientHtml = '';
  try {
    await hydrateRoot(
      tree,
      getInitialContext(true),
      rstest.fn(),
      async (el: ReactElement) => {
        clientHtml = render(el);
        return {} as HTMLElement;
      },
    );
  } finally {
    delete (window as any)._SSR_DATA;
  }

  const ids = (html: string) => html.match(/(?:id|for)="[^"]+"/g);
  expect(ids(serverHtml)).toHaveLength(4);
  expect(ids(clientHtml)).toEqual(ids(serverHtml));
});
