import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import * as publicEffectRuntime from '@modern-js/bff-effect/effect';
import * as publicEffectEdgeRuntime from '@modern-js/bff-effect/effect-edge';
import * as federation from '@modern-js/plugin-bff-extensions/backend-federation';
import * as federationNode from '@modern-js/plugin-bff-extensions/backend-federation/node';

const execFileAsync = promisify(execFile);

const loadedEffectApi = {
  backendFederationContract: {
    compatibility: {
      build: 'checkout-build-21',
      unitId: 'checkout@21',
    },
    name: 'verticalCheckoutBackend',
    runtimeFramework: 'effect',
    strictEffectApproach: true,
  },
  runtime: { brand: 'strict-effect-runtime' },
};

describe('canonical federation public contracts', () => {
  test('canonical Node entries preserve the owned public behavior', async () => {
    const dispatched = await publicEffectRuntime.dispatchEffectBffRequest(
      (request, context) => {
        expect(new URL(request.url).pathname).toBe('/checkout');
        expect(context.path).toBe('/api/checkout');
        return Promise.resolve(new Response('effect-dispatched'));
      },
      new Request('https://example.test/api/checkout'),
      { prefix: '/api' },
    );

    expect(dispatched.status).toBe(200);
    await expect(dispatched.text()).resolves.toBe('effect-dispatched');

    const resolvedEntries: string[] = [];
    const loaded = await federationNode.loadBackendFederatedEffectApi({
      expected: {
        buildMarker: 'checkout-build-21',
        unitId: 'checkout@21',
      },
      hostName: 'legacy-node',
      remote: {
        entry: 'binding:verticalCheckoutBackend',
        name: 'verticalCheckoutBackend',
        type: 'module',
      },
      plugins: [
        federation.createBackendFederationLoadEntryPlugin({
          resolveEntry(remote) {
            resolvedEntries.push(remote.entry);
            return {
              get(id) {
                expect(id).toBe('./effect-api');
                return async () => loadedEffectApi;
              },
              init() {},
            };
          },
        }),
      ],
    });

    expect(resolvedEntries).toEqual(['binding:verticalCheckoutBackend']);
    expect(loaded).toBe(loadedEffectApi);
  });

  test('canonical edge entries preserve dispatch', async () => {
    const dispatched = await publicEffectEdgeRuntime.dispatchEffectBffRequest(
      () => Promise.resolve(new Response('edge-dispatched')),
      new Request('https://example.test/checkout'),
    );

    expect(dispatched.status).toBe(200);
    await expect(dispatched.text()).resolves.toBe('edge-dispatched');
  });

  test('the built Node federation entry preserves arbitrary file and data ESM remotes', async () => {
    const tempDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'modern-built-backend-federation-'),
    );
    const fileEntry = path.join(tempDirectory, 'file-remote.mjs');
    const createEntrySource = (name: string, brand: string) => `
      export function init() {}
      export function get(id) {
        if (id !== './effect-api') throw new Error('Unexpected expose ' + id);
        return async () => ({
          backendFederationContract: {
            compatibility: { build: 'built-21', unitId: 'built@21' },
            name: '${name}',
            runtimeFramework: 'effect',
            strictEffectApproach: true,
          },
          runtime: { brand: '${brand}' },
        });
      }
    `;

    try {
      await fs.writeFile(
        fileEntry,
        createEntrySource('builtFileBackend', 'built-file-esm'),
      );
      const dataEntry = `data:text/javascript;charset=utf-8,${encodeURIComponent(
        createEntrySource('builtDataBackend', 'built-data-esm'),
      )}`;
      const childScript = `
        const specifier = '@modern-js/plugin-bff-extensions/backend-federation/node';
        const { loadBackendFederatedEffectApi } = await import(specifier);
        const remotes = JSON.parse(process.env.MODERN_BUILT_ESM_REMOTES);
        const results = [];
        for (const remote of remotes) {
          const loaded = await loadBackendFederatedEffectApi({
            expected: { buildMarker: 'built-21', unitId: 'built@21' },
            hostName: 'built-node-compatibility-host',
            remote: { ...remote, type: 'module' },
        });
        results.push(loaded.runtime.brand);
      }
      process.stdout.write('MODERN_BUILT_RESULT=' + JSON.stringify({
          results,
        }));
      `;
      const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '--eval', childScript],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            MODERN_BUILT_ESM_REMOTES: JSON.stringify([
              {
                entry: pathToFileURL(fileEntry).href,
                name: 'builtFileBackend',
              },
              { entry: dataEntry, name: 'builtDataBackend' },
            ]),
          },
        },
      );
      const output = JSON.parse(
        stdout.slice(stdout.indexOf('MODERN_BUILT_RESULT=') + 20),
      );

      expect(output.results).toEqual(['built-file-esm', 'built-data-esm']);
    } finally {
      await fs.rm(tempDirectory, { force: true, recursive: true });
    }
  });
});
