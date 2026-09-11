import React from 'react';
import { renderSSRStream } from '../../src/server/ssr/ssr';
import { renderedFlightRoots } from '../fixtures/rsc-server';

beforeEach(() => {
  renderedFlightRoots.length = 0;
});
afterEach(() => {
  rstest.unstubAllEnvs();
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
});
test.each([
  'node',
  'edge',
])('RSC (%s) keeps the original Flight input and wraps only the real HTML render', async environment => {
  rstest.stubEnv('MODERN_SSR_ENV', environment);
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
  expect(html).toContain('<section><p>body</p></section>');
  expect(html).toContain('test Flight payload');
});
