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
          plugins: [
            {
              name: 'bundle-context-identity-helper',
              setup(api) {
                api.onResolve(
                  { filter: /^@modern-js\/runtime-extensions\/react-context$/ },
                  () => ({
                    path: resolve(
                      __dirname,
                      '../../../runtime-extensions/src/reactContext.ts',
                    ),
                  }),
                );
              },
            },
          ],
        });
        return import(pathToFileURL(outfile).href);
      }),
    );
    const [host, consumer] = copies;
    expect(host.RuntimeContext).toBe(consumer.RuntimeContext);
    expect(host.InternalRuntimeContext).toBe(consumer.InternalRuntimeContext);
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
