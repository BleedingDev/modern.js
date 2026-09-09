import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement, useContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.edge';

test('shares context identity across bundles while isolating SSR request values', async () => {
  const tempDir = await mkdtemp(resolve(__dirname, '.runtime-context-'));
  try {
    const copies = await Promise.all(
      ['host', 'consumer'].map(async name => {
        const outfile = resolve(tempDir, `${name}.mjs`);
        await build({
          entryPoints: [
            resolve(__dirname, '../../src/core/context/runtime.ts'),
          ],
          bundle: true,
          packages: 'external',
          platform: 'node',
          format: 'esm',
          outfile,
        });
        return import(pathToFileURL(outfile).href);
      }),
    );
    const [host, consumer] = copies;
    expect(host.RuntimeContext).toBe(consumer.RuntimeContext);
    expect(host.InternalRuntimeContext).toBe(consumer.InternalRuntimeContext);
    expect(host.RuntimeComponentResolverContext).toBe(
      consumer.RuntimeComponentResolverContext,
    );
    expect(host.RuntimeContext).not.toBe(host.InternalRuntimeContext);
    function ReadRequest() {
      const context = useContext(consumer.RuntimeContext) as {
        language: string;
      };
      const internal = useContext(consumer.InternalRuntimeContext) as {
        requestId: string;
      };
      return createElement('p', { lang: context.language }, internal.requestId);
    }
    const request = (language: string) =>
      createElement(
        host.RuntimeContext.Provider,
        { value: { language } },
        createElement(
          host.InternalRuntimeContext.Provider,
          { value: { requestId: language } },
          createElement(ReadRequest),
        ),
      );
    for (const language of ['en', 'cs', 'en']) {
      expect(renderToStaticMarkup(request(language))).toBe(
        `<p lang="${language}">${language}</p>`,
      );
    }
    const rendered = await Promise.all(
      ['cs', 'en', 'cs', 'en'].map(async language => {
        const stream = await renderToReadableStream(request(language));
        return new Response(stream).text();
      }),
    );
    expect(rendered).toEqual(
      ['cs', 'en', 'cs', 'en'].map(
        language => `<p lang="${language}">${language}</p>`,
      ),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolves a separately bundled public head through the native provider identity', async () => {
  const tempDir = await mkdtemp(resolve(__dirname, '.runtime-resolver-'));
  try {
    const [provider, consumer] = await Promise.all(
      [
        ['provider', '../../src/core/context/runtime.ts'],
        ['head', '../../src/exports/head.ts'],
      ].map(async ([name, entry]) => {
        const outfile = resolve(tempDir, `${name}.mjs`);
        await build({
          entryPoints: [resolve(__dirname, entry)],
          bundle: true,
          packages: 'external',
          platform: 'node',
          format: 'esm',
          outfile,
        });
        return import(pathToFileURL(outfile).href);
      }),
    );
    const Selected = ({ title }: { title: string }) => {
      const request = useContext(provider.RuntimeContext) as {
        requestId: string;
      };
      return createElement('p', null, `${request.requestId}:${title}`);
    };
    const names: string[] = [];
    const resolveComponent = (
      _component: unknown,
      { name }: { name: string },
    ) => {
      names.push(name);
      return Selected;
    };
    const request = (requestId: string) =>
      createElement(
        provider.RuntimeComponentResolverContext.Provider,
        { value: resolveComponent },
        createElement(
          provider.RuntimeContext.Provider,
          { value: { requestId } },
          createElement(consumer.Helmet, { title: 'head' }),
        ),
      );
    expect(renderToStaticMarkup(request('first'))).toBe('<p>first:head</p>');
    expect(renderToStaticMarkup(request('second'))).toBe('<p>second:head</p>');
    expect(names).toEqual(['head.Helmet', 'head.Helmet']);
    expect(provider.RuntimeContext).toBe(
      Reflect.get(
        globalThis,
        Symbol.for('@modern-js/runtime:react-context:v1:public'),
      ),
    );
    expect(provider.InternalRuntimeContext).toBe(
      Reflect.get(
        globalThis,
        Symbol.for('@modern-js/runtime:react-context:v1:internal'),
      ),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
