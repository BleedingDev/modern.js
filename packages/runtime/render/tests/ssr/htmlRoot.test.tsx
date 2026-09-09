import React from 'react';
import { renderSSRStream } from '../../src/server/ssr/ssr';
import { renderedFlightRoots } from '../fixtures/rsc-server';

beforeEach(() => {
  renderedFlightRoots.length = 0;
});
test('ordinary HTML root callback wraps the real React render', async () => {
  const root = <p>body</p>;
  const wrapHtmlRoot = rstest.fn(value => <section>{value}</section>);
  const stream = await renderSSRStream(root, {
    request: new Request('http://localhost/'),
    rscRoot: root,
    wrapHtmlRoot,
  });
  expect(await new Response(stream).text()).toBe(
    '<section><p>body</p></section>',
  );
  expect(wrapHtmlRoot).toHaveBeenCalledExactlyOnceWith(root);
  expect(renderedFlightRoots).toEqual([]);
});
test('HTML root callback may intentionally render null', async () => {
  const root = <p>body</p>;
  const stream = await renderSSRStream(root, {
    request: new Request('http://localhost/'),
    rscRoot: root,
    wrapHtmlRoot: () => null,
  });
  expect(await new Response(stream).text()).toBe('');
});
test('RSC keeps the original Flight input and wraps only the real HTML render', async () => {
  const root = <p>body</p>;
  const flightRoot = <p>flight</p>;
  const wrapHtmlRoot = rstest.fn(value => <section>{value}</section>);
  const stream = await renderSSRStream(root, {
    request: new Request('http://localhost/'),
    rscRoot: flightRoot,
    rscManifest: { clientManifest: {}, serverConsumerModuleMap: {} },
    wrapHtmlRoot,
  });
  const html = await new Response(stream).text();
  expect(renderedFlightRoots).toEqual([flightRoot]);
  expect(renderedFlightRoots[0]).toBe(flightRoot);
  expect(wrapHtmlRoot).toHaveBeenCalledTimes(1);
  expect(html).toContain('<section><p>body</p></section>');
  expect(html).toContain('test Flight payload');
});
