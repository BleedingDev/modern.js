import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { loadBackendFederatedEffectApiFromManifest } from '@modern-js/plugin-bff-extensions/backend-federation-manifest/node';
import { Effect, ManagedRuntime } from 'effect';
import { HttpApi } from 'effect/unstable/httpapi';
import { emitBackendFederationArtifacts } from '../../src/backend-federation-build';

const temporaryDirectories: string[] = [];

const createTempDir = async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'modern-backend-mf-'),
  );
  temporaryDirectories.push(directory);
  return directory;
};

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const createBuildArtifact = (overrides: Record<string, unknown> = {}) => {
  const deliveryUnit = {
    schemaVersion: 1,
    kind: 'microvertical-delivery-unit',
    appId: 'explore',
    unitId: 'tractor-store-vertical-demo/explore',
    packageName: '@tractor-store-vertical-demo/explore',
    version: '0.1.0',
    sourceRevision: 'workspace',
    buildMarker: 'tractor-explore-build-1234',
    deployProfile: 'cloudflare-ssr-mf-effect-v1',
    build: 'tractor-explore-build-1234',
    ...overrides,
  };

  return {
    schemaVersion: 1,
    kind: 'ultramodern-build-artifact',
    deliveryUnit,
    surfaces: {
      ui: { ...deliveryUnit, surface: 'ui' },
      api: { ...deliveryUnit, surface: 'api' },
    },
  };
};

type WorkspaceOptions = {
  artifactOverrides?: Record<string, unknown>;
  backendBase?: string;
  compactDeliveryUnit?: Record<string, unknown>;
  distName?: string;
  effectApiSource?: string;
  appId?: string;
};

const createWorkspace = async ({
  artifactOverrides = {},
  backendBase = 'http://localhost:3021',
  compactDeliveryUnit,
  distName = 'dist',
  effectApiSource = 'export const backendFederationContract = {};\n',
  appId = 'explore',
}: WorkspaceOptions = {}) => {
  const workspaceRoot = await createTempDir();
  const appDirectory = path.join(workspaceRoot, 'verticals/explore');
  const distDirectory = path.join(appDirectory, distName);
  await fs.mkdir(path.join(appDirectory, 'api'), { recursive: true });
  await fs.mkdir(path.join(appDirectory, 'shared'), { recursive: true });
  await fs.symlink(
    path.resolve(__dirname, '../../node_modules'),
    path.join(appDirectory, 'node_modules'),
    'dir',
  );
  await fs.writeFile(
    path.join(appDirectory, 'api/effect-api.ts'),
    effectApiSource,
  );
  await fs.writeFile(
    path.join(appDirectory, 'backend-federation.config.ts'),
    'export default {};\n',
  );
  await writeJson(
    path.join(appDirectory, 'shared/ultramodern-build.json'),
    createBuildArtifact(artifactOverrides),
  );
  await writeJson(path.join(workspaceRoot, '.modernjs/ultramodern.json'), {
    topology: {
      apps: [
        {
          id: appId,
          kind: 'vertical',
          package: '@tractor-store-vertical-demo/explore',
          path: 'verticals/explore',
          port: 3021,
          api: { prefix: '/explore-api', stem: 'explore' },
          moduleFederation: {
            name: 'verticalExplore',
            manifestUrl: `${backendBase}/mf-manifest.json`,
          },
          backendFederation: {
            name: 'verticalExploreBackend',
            versionBoundary: {
              ui: { manifestUrl: `${backendBase}/mf-manifest.json` },
            },
            executionSurfaces: {
              node: {
                remoteName: 'verticalExploreBackend',
                manifestUrl: `${backendBase}/backend-mf-manifest.json`,
                containerEntry: `${backendBase}/backendRemoteEntry.cjs`,
                remoteType: 'commonjs-module',
              },
            },
          },
          ...(compactDeliveryUnit ? { deliveryUnit: compactDeliveryUnit } : {}),
        },
      ],
    },
  });
  return { appDirectory, distDirectory, workspaceRoot };
};

const withSourceRevision = async <T>(
  revision: string,
  callback: () => Promise<T>,
) => {
  const previous = process.env.ULTRAMODERN_SOURCE_REVISION;
  process.env.ULTRAMODERN_SOURCE_REVISION = revision;
  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.ULTRAMODERN_SOURCE_REVISION;
    } else {
      process.env.ULTRAMODERN_SOURCE_REVISION = previous;
    }
  }
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe('backend federation build artifacts', () => {
  it('loads its emitted container from a verified live HTTP path', async () => {
    const publicBasePath = '/delivery/explore/assets';
    let distDirectory = '';
    const requests: string[] = [];
    const server = http.createServer(async (request, response) => {
      const requestPath = new URL(request.url ?? '/', 'http://127.0.0.1')
        .pathname;
      requests.push(requestPath);
      const fileName = requestPath.endsWith('backend-mf-manifest.json')
        ? 'backend-mf-manifest.json'
        : requestPath.endsWith('backendRemoteEntry.cjs')
          ? 'backendRemoteEntry.cjs'
          : undefined;
      if (!fileName) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader(
        'content-type',
        fileName.endsWith('.json') ? 'application/json' : 'text/javascript',
      );
      response.end(await fs.readFile(path.join(distDirectory, fileName)));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected backend federation test server address.');
      }
      const origin = `http://127.0.0.1:${address.port}`;
      const workspace = await createWorkspace({
        backendBase: `${origin}${publicBasePath}`,
        effectApiSource: `
export const backendFederationContract = {
  name: 'verticalExploreBackend',
  role: 'microvertical-server',
  runtimeFramework: 'effect',
  strictEffectApproach: true,
};
import { Layer, ManagedRuntime, Schema } from 'effect';
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
export const api = HttpApi.make('ExploreApi').add(
  HttpApiGroup.make('explore').add(
    HttpApiEndpoint.get('ping', '/ping', { success: Schema.String }),
  ),
);
export const runtime = ManagedRuntime.make(Layer.empty);
export { api as nativeApi, runtime as nativeRuntime };
`,
      });
      distDirectory = workspace.distDirectory;

      await withSourceRevision('2'.repeat(40), () =>
        emitBackendFederationArtifacts(
          workspace.appDirectory,
          workspace.distDirectory,
        ),
      );
      const manifest = JSON.parse(
        await fs.readFile(
          path.join(workspace.distDirectory, 'backend-mf-manifest.json'),
          'utf8',
        ),
      );
      const loaded = await loadBackendFederatedEffectApiFromManifest({
        hostName: `appToolsLiveHttpHost-${Date.now()}`,
        manifestUrl: `${origin}${publicBasePath}/backend-mf-manifest.json`,
        entryPolicy: {
          expected: {
            byteLength: manifest.entry.byteLength,
            entryUrl: manifest.entry.url,
            remoteName: manifest.backendFederation.name,
            sha256: manifest.entry.sha256,
          },
        },
        expected: {
          buildMarker: manifest.backendFederation.deliveryUnit.buildMarker,
          unitId: manifest.backendFederation.deliveryUnit.unitId,
        },
      });

      expect(HttpApi.isHttpApi(loaded.api)).toBe(true);
      expect(loaded.api).toBe(Reflect.get(loaded, 'nativeApi'));
      expect(loaded.runtime).toBe(Reflect.get(loaded, 'nativeRuntime'));
      if (!ManagedRuntime.isManagedRuntime(loaded.runtime)) {
        throw new Error('Expected the emitted native Effect ManagedRuntime.');
      }
      try {
        await expect(
          loaded.runtime.runPromise(Effect.succeed('emitted-live-http')),
        ).resolves.toBe('emitted-live-http');
      } finally {
        await loaded.runtime.dispose();
      }
      expect(requests).toEqual([
        `${publicBasePath}/backend-mf-manifest.json`,
        `${publicBasePath}/backendRemoteEntry.cjs`,
      ]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  });

  it('stamps sourceRevision consistently in manifest and delivery-unit artifact', async () => {
    const workspace = await createWorkspace({ distName: 'dist-one' });
    const secondDistDirectory = path.join(
      path.dirname(workspace.distDirectory),
      'dist-two',
    );
    const sourceRevision = '1'.repeat(40);
    const secondSourceRevision = '2'.repeat(40);

    const first = await withSourceRevision(sourceRevision, () =>
      emitBackendFederationArtifacts(
        workspace.appDirectory,
        workspace.distDirectory,
      ),
    );
    const second = await withSourceRevision(secondSourceRevision, () =>
      emitBackendFederationArtifacts(
        workspace.appDirectory,
        secondDistDirectory,
      ),
    );

    expect(first?.deliveryUnitArtifactPath).toBeDefined();
    expect(second?.deliveryUnitArtifactPath).toBeDefined();
    const firstManifest = JSON.parse(
      await fs.readFile(
        path.join(workspace.distDirectory, 'backend-mf-manifest.json'),
        'utf8',
      ),
    );
    const secondManifest = JSON.parse(
      await fs.readFile(
        path.join(secondDistDirectory, 'backend-mf-manifest.json'),
        'utf8',
      ),
    );
    const firstArtifact = JSON.parse(
      await fs.readFile(first!.deliveryUnitArtifactPath!, 'utf8'),
    );
    const secondArtifact = JSON.parse(
      await fs.readFile(second!.deliveryUnitArtifactPath!, 'utf8'),
    );

    expect(firstManifest.backendFederation.deliveryUnit.sourceRevision).toBe(
      sourceRevision,
    );
    expect(secondManifest.backendFederation.deliveryUnit.sourceRevision).toBe(
      secondSourceRevision,
    );
    expect(firstArtifact.deliveryUnit.sourceRevision).toBe(sourceRevision);
    expect(firstArtifact.surfaces.ui.sourceRevision).toBe(sourceRevision);
    expect(firstArtifact.surfaces.api.sourceRevision).toBe(sourceRevision);
    expect(secondArtifact.deliveryUnit.sourceRevision).toBe(
      secondSourceRevision,
    );
  });

  it('rejects delivery-unit and generated build identity drift', async () => {
    const workspace = await createWorkspace({
      artifactOverrides: {
        build: 'tractor-explore-build-DRIFTED',
        buildMarker: 'tractor-explore-build-DRIFTED',
      },
      compactDeliveryUnit: {
        unitId: 'tractor-store-vertical-demo/explore',
        buildMarker: 'tractor-explore-build-1234',
        sourceRevision: 'workspace',
        packageName: '@tractor-store-vertical-demo/explore',
        version: '0.1.0',
      },
    });

    await expect(
      emitBackendFederationArtifacts(
        workspace.appDirectory,
        workspace.distDirectory,
      ),
    ).rejects.toThrow(/Delivery-unit identity drift/u);
  });

  it('rejects a build artifact belonging to another vertical', async () => {
    const workspace = await createWorkspace({
      artifactOverrides: { appId: 'inventory' },
    });

    await expect(
      emitBackendFederationArtifacts(
        workspace.appDirectory,
        workspace.distDirectory,
      ),
    ).rejects.toThrow(
      /appId: topology=explore vs ultramodern-build=inventory/u,
    );
  });

  it('skips apps without generated backend federation metadata', async () => {
    const workspaceRoot = await createTempDir();
    const appDirectory = path.join(workspaceRoot, 'apps/shell-super-app');
    const distDirectory = path.join(appDirectory, 'dist');
    await writeJson(path.join(workspaceRoot, '.modernjs/ultramodern.json'), {
      topology: {
        apps: [
          {
            id: 'shell-super-app',
            kind: 'shell',
            path: 'apps/shell-super-app',
          },
        ],
      },
    });

    await expect(
      emitBackendFederationArtifacts(appDirectory, distDirectory),
    ).resolves.toBeUndefined();
  });
});
