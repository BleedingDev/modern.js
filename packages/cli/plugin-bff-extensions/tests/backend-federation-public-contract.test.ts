import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import * as publicEffectRuntime from '@modern-js/bff-effect/effect';
import * as publicEffectEdgeRuntime from '@modern-js/bff-effect/effect-edge';
import * as federation from '@modern-js/plugin-bff-extensions/backend-federation';
import * as federationEdge from '@modern-js/plugin-bff-extensions/backend-federation/edge';
import * as federationNode from '@modern-js/plugin-bff-extensions/backend-federation/node';
import * as manifest from '@modern-js/plugin-bff-extensions/backend-federation-manifest';
import * as manifestNode from '@modern-js/plugin-bff-extensions/backend-federation-manifest/node';
import { semver } from '@modern-js/utils';

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
  test('does not restore forgeable validator branding or new extension internals', () => {
    expect(publicEffectRuntime).not.toHaveProperty(
      'EFFECT_VALIDATOR_AWARE_FACTORY',
    );
    expect(publicEffectRuntime).not.toHaveProperty(
      'isValidatorAwareHandlerFactory',
    );
    expect(publicEffectRuntime).not.toHaveProperty(
      'BACKEND_FEDERATION_MANIFEST_ADAPTER_FAILURE_EVENT',
    );
  });

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
    expect(
      federation.validateExpectedBackendFederationIdentity(loadedEffectApi, {
        buildMarker: 'checkout-build-21',
        unitId: 'checkout@21',
      }),
    ).toEqual([]);

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
    const inlineManifest = { backendFederation: { format: 'compatibility' } };
    await expect(
      manifest.loadBackendFederationManifest({
        manifest: inlineManifest,
      }),
    ).resolves.toBe(inlineManifest);

    const fallback =
      await manifestNode.loadBackendFederatedEffectApiFromManifest({
        fallback(error) {
          expect(error.code).toBe('manifest_invalid');
          return loadedEffectApi;
        },
        hostName: 'legacy-manifest',
        manifest: {},
      });
    expect(fallback).toBe(loadedEffectApi);
  });

  test('canonical edge entries preserve dispatch without exposing manifest or Node APIs', async () => {
    const dispatched = await publicEffectEdgeRuntime.dispatchEffectBffRequest(
      () => Promise.resolve(new Response('edge-dispatched')),
      new Request('https://example.test/checkout'),
    );

    expect(dispatched.status).toBe(200);
    await expect(dispatched.text()).resolves.toBe('edge-dispatched');

    for (const nodeOnlyExport of [
      'BackendFederationManifestAdapterError',
      'loadBackendFederatedEffectApiFromManifest',
      'loadBackendFederationManifest',
      'resolveBackendFederationRemoteFromManifest',
    ]) {
      expect(publicEffectEdgeRuntime).not.toHaveProperty(nodeOnlyExport);
      expect(federationEdge).not.toHaveProperty(nodeOnlyExport);
    }
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
        const resolvedEntry = import.meta.resolve(specifier);
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
          resolvedEntry,
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

      expect(output.resolvedEntry).toMatch(
        /plugin-bff-extensions\/dist\/esm-node\/backend-federation\/node\.mjs$/u,
      );
      expect(output.results).toEqual(['built-file-esm', 'built-data-esm']);
    } finally {
      await fs.rm(tempDirectory, { force: true, recursive: true });
    }
  });

  test.each([
    'service',
    'binding',
  ])('preserves caller-pinned %s providers through the canonical edge entry', async entryScheme => {
    const resolvedEntries: string[] = [];

    const loaded = await federationEdge.loadBackendFederatedEffectApi({
      expected: {
        buildMarker: 'checkout-build-21',
        unitId: 'checkout@21',
      },
      hostName: `legacy-edge-${entryScheme}`,
      remote: {
        entry: `${entryScheme}:verticalCheckoutBackend`,
        name: 'verticalCheckoutBackend',
        type: 'module',
      },
      plugins: [
        federationEdge.createBackendFederationLoadEntryPlugin({
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

    expect(resolvedEntries).toEqual([`${entryScheme}:verticalCheckoutBackend`]);
    expect(loaded).toBe(loadedEffectApi);
  });
});

describe('Effect package peer closure', () => {
  test('keeps the exact optional Effect cohort and satisfies telemetry peers', async () => {
    const require = createRequire(import.meta.url);
    const effectRuntimePackageJson = JSON.parse(
      await fs.readFile(
        require.resolve('@modern-js/bff-effect/package.json'),
        'utf8',
      ),
    );
    const openTelemetryPackage = JSON.parse(
      await fs.readFile(
        require.resolve('@effect/opentelemetry/package.json'),
        'utf8',
      ),
    );
    for (const [peerName, peerRange] of Object.entries(
      openTelemetryPackage.peerDependencies ?? {},
    )) {
      // `effect` is declared as an optional exact peer (not a dependency) so a
      // consumer keeps a single Effect Context/Service identity; every other
      // @effect/opentelemetry peer stays a hard dependency of the Effect
      // runtime package that imports it.
      const dependencyRange =
        effectRuntimePackageJson.dependencies[peerName] ??
        effectRuntimePackageJson.peerDependencies?.[peerName];
      expect({
        compatible: semver.subset(dependencyRange, peerRange as string, {
          includePrerelease: true,
        }),
        dependencyRange,
        peerName,
        peerRange,
      }).toEqual({
        compatible: true,
        dependencyRange: expect.any(String),
        peerName,
        peerRange,
      });
    }

    for (const name of ['effect', '@effect/opentelemetry']) {
      expect({
        name,
        dependency: effectRuntimePackageJson.dependencies[name],
        peer: effectRuntimePackageJson.peerDependencies?.[name],
        optional:
          effectRuntimePackageJson.peerDependenciesMeta?.[name]?.optional,
        dev: effectRuntimePackageJson.devDependencies?.[name],
      }).toEqual({
        name,
        dependency: undefined,
        peer: effectRuntimePackageJson.devDependencies?.[name],
        optional: true,
        dev: expect.stringMatching(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
      });
    }
    // The whole Effect cohort moves in lockstep at one exact version.
    expect(
      effectRuntimePackageJson.devDependencies['@effect/opentelemetry'],
    ).toBe(effectRuntimePackageJson.devDependencies.effect);
  });
});
