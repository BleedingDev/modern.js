import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';

const ssrArtifactPath = path.resolve(__dirname, '../../dist/esm/ssr.mjs');
const hasArtifact = fs.existsSync(ssrArtifactPath);
const renderPackagePath = path.resolve(__dirname, '../..');
const rscArtifactPaths = ['rsc.mjs', 'rscWorker.mjs'].map(file =>
  path.join(renderPackagePath, 'dist/esm', file),
);

describe('ssr build artifact', () => {
  test.skipIf(!hasArtifact)(
    'renders through the published ESM SSR entry under a bundler runtime',
    async () => {
      const bundlerGlobal = globalThis as typeof globalThis & {
        __webpack_require__?: { u: (chunkId: string | number) => string };
      };
      const previousBundlerRuntime = bundlerGlobal.__webpack_require__;
      bundlerGlobal.__webpack_require__ = {
        u: chunkId => String(chunkId),
      };

      try {
        const runtime = await import(pathToFileURL(ssrArtifactPath).href);
        const stream = await runtime.renderSSRStream(
          React.createElement('main', null, 'published SSR artifact'),
          {
            request: new Request('https://example.com/'),
            rscRoot: React.createElement(
              'main',
              null,
              'published SSR artifact',
            ),
          },
        );
        const html = await new Response(stream).text();

        expect(html).toContain('<main>published SSR artifact</main>');
      } finally {
        if (previousBundlerRuntime === undefined) {
          delete bundlerGlobal.__webpack_require__;
        } else {
          bundlerGlobal.__webpack_require__ = previousBundlerRuntime;
        }
      }
    },
  );
});

describe('RSC build artifacts', () => {
  test.skipIf(!rscArtifactPaths.every(file => fs.existsSync(file)))(
    'preserves the public API and native rendering with distinct Node and edge bindings',
    () => {
      const [nodeArtifact, workerArtifact] = rscArtifactPaths.map(file =>
        fs.readFileSync(file, 'utf8'),
      );
      expect(nodeArtifact).toContain('react-server-dom-rspack/server.node');
      expect(nodeArtifact).toContain('react-server-dom-rspack/client.node');
      expect(nodeArtifact).not.toContain('react-server-dom-rspack/server.edge');
      expect(workerArtifact).toContain('react-server-dom-rspack/server.edge');
      expect(workerArtifact).toContain('react-server-dom-rspack/client.edge');
      expect(workerArtifact).not.toMatch(
        /react-server-dom-rspack\/(?:server|client)\.node/,
      );

      const manifest = JSON.parse(
        fs.readFileSync(path.join(renderPackagePath, 'package.json'), 'utf8'),
      );
      for (const entry of ['./rsc', './rsc-worker']) {
        expect(
          fs.existsSync(
            path.join(renderPackagePath, manifest.exports[entry].types),
          ),
        ).toBe(true);
      }

      // The real Flight packages require React's server condition and the
      // manifest/loader contract normally supplied by the application bundler.
      for (const artifactPath of rscArtifactPaths) {
        const result = spawnSync(
          process.execPath,
          [
            '--conditions=react-server',
            '--input-type=module',
            '-e',
            `
            import assert from 'node:assert/strict';
            import React from 'react';
            const modules = {
              actionModule: { action: () => React.createElement('main', null, 'action result') },
            };
            globalThis.__webpack_require__ = Object.assign(id => modules[id], { u: String });
            globalThis.__webpack_chunk_load__ = () => Promise.resolve();
            globalThis.__rspack_rsc_manifest__ = {
              clientManifest: {},
              serverManifest: { action: { id: 'actionModule', chunks: [], name: 'action' } },
              serverConsumerModuleMap: {},
              moduleLoading: { prefix: '', crossOrigin: '' },
              entryCssFiles: { main: ['/app.css'] },
              entryJsFiles: [],
            };
            globalThis.__webpack_require__.rscM = globalThis.__rspack_rsc_manifest__;
            const expectedExports = [
              'createFromReadableStream', 'handleAction', 'registerClientReference',
              'registerServerReference', 'renderCSRWithRSC', 'renderRsc', 'renderToReadableStream',
            ];
              const runtime = await import(${JSON.stringify(pathToFileURL(artifactPath).href)});
              assert.deepEqual(Object.keys(runtime).sort(), expectedExports);
              const root = React.createElement('main', null, 'native RSC');
              const decoded = await runtime.createFromReadableStream(runtime.renderRsc({ element: root }));
              assert.equal(decoded.type, 'main');
              assert.equal(decoded.props.children, 'native RSC');
              const response = await runtime.renderCSRWithRSC({
                html: '<html><head></head><body>shell</body></html>', rscRoot: root,
              });
              const html = await response.text();
              assert.ok(html.includes('<link href="/app.css" rel="stylesheet" /></head>'));
              assert.ok(html.includes('__FLIGHT_DATA'));
              assert.ok(html.lastIndexOf('</script>') < html.lastIndexOf('</body>'));
              assert.equal((await runtime.handleAction(new Request('https://example.com/'))).status, 405);
              const action = await runtime.handleAction(new Request('https://example.com/', {
                method: 'POST', headers: { 'x-rsc-action': 'action' }, body: '[]',
              }));
              assert.equal(action.status, 200);
              assert.equal(action.headers.get('content-type'), 'text/x-component');
              const actionResult = await runtime.createFromReadableStream(action.body);
              assert.equal(actionResult.props.children, 'action result');
              let releaseFlight;
              const ready = new Promise(resolve => { releaseFlight = resolve; });
              async function Delayed() {
                await ready;
                return React.createElement('span', null, 'delayed Flight');
              }
              const longTag = '<section data-value="' + 'x'.repeat(9000) + '">shell</section>';
              const delayed = await runtime.renderCSRWithRSC({
                html: '<html><head></head><body>' + longTag + '</body></html>',
                rscRoot: React.createElement(Delayed),
              });
              const reader = delayed.body.getReader();
              const decoder = new TextDecoder();
              let delayedHtml = decoder.decode((await reader.read()).value, { stream: true });
              assert.ok(delayedHtml.includes(longTag));
              assert.ok(!delayedHtml.includes('</body>'));
              releaseFlight();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                delayedHtml += decoder.decode(value, { stream: true });
              }
              delayedHtml += decoder.decode();
              assert.ok(delayedHtml.includes('delayed Flight'));
              assert.ok(delayedHtml.lastIndexOf('</script>') < delayedHtml.lastIndexOf('</body>'));
              assert.equal(delayedHtml.split('</body>').length, 2);
              assert.equal(delayedHtml.split('</html>').length, 2);
          `,
          ],
          { cwd: renderPackagePath, encoding: 'utf8', timeout: 10000 },
        );
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr || result.stdout).toBe(0);
      }
    },
  );
});
