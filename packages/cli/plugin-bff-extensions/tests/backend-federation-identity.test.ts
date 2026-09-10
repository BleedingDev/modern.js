/**
 * MV-G23: mandatory delivery-unit identity in public backend federation
 * loads. The identity-aware overload validates expected unitId + buildMarker
 * against the loaded expose; the legacy identity-less signature stays
 * additive-compatible but emits a deprecation warning.
 */
import type { ModuleFederation } from '@module-federation/runtime';
import type { BackendFederationExpectedIdentity } from '../src/backend-federation/edge';
import { loadBackendFederatedEffectApi } from '../src/backend-federation/load';

const expected: BackendFederationExpectedIdentity = {
  unitId: 'acme/catalog',
  buildMarker: 'catalog-build-123',
};

function createLoadedModule(
  compatibility: Record<string, unknown> | null = {
    unitId: expected.unitId,
    build: expected.buildMarker,
  },
) {
  return {
    api: {},
    runtime: {},
    backendFederationContract: {
      name: 'verticalCatalogBackend',
      runtimeFramework: 'effect',
      strictEffectApproach: true,
      ...(compatibility === null ? {} : { compatibility }),
    },
  };
}

function createStubRuntime(loaded: unknown): ModuleFederation {
  return {
    loadRemote: async () => loaded,
  } as unknown as ModuleFederation;
}

function loadWith(
  loaded: unknown,
  identity?: BackendFederationExpectedIdentity,
) {
  return loadBackendFederatedEffectApi({
    hostName: 'testHost',
    remote: {
      entry: 'static:verticalCatalogBackend',
      name: 'verticalCatalogBackend',
    },
    runtime: createStubRuntime(loaded),
    ...(identity === undefined ? {} : { expected: identity }),
  });
}

describe('loadBackendFederatedEffectApi identity enforcement (MV-G23)', () => {
  let warnSpy: ReturnType<typeof rstest.spyOn>;

  beforeEach(() => {
    warnSpy = rstest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('loads and stays silent when the expected identity matches', async () => {
    const loaded = await loadWith(createLoadedModule(), expected);
    expect(loaded.backendFederationContract?.compatibility?.unitId).toBe(
      'acme/catalog',
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits a deprecation warning for identity-less legacy loads', async () => {
    await loadWith(createLoadedModule());
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain(
      'without an expected delivery-unit identity',
    );
  });

  it('rejects a unitId mismatch', async () => {
    await expect(
      loadWith(
        createLoadedModule({
          unitId: 'acme/other',
          build: expected.buildMarker,
        }),
        expected,
      ),
    ).rejects.toThrow(/delivery-unit identity mismatch.*acme\/other/su);
  });

  it('rejects a buildMarker mismatch', async () => {
    await expect(
      loadWith(
        createLoadedModule({ unitId: expected.unitId, build: 'stale-build' }),
        expected,
      ),
    ).rejects.toThrow(/delivery-unit identity mismatch.*stale-build/su);
  });

  it('rejects missing compatibility metadata when identity is expected', async () => {
    await expect(loadWith(createLoadedModule(null), expected)).rejects.toThrow(
      /declares no compatibility metadata/u,
    );
  });

  it('rejects partially missing identity fields when identity is expected', async () => {
    await expect(
      loadWith(createLoadedModule({ unitId: expected.unitId }), expected),
    ).rejects.toThrow(/compatibility\.build: missing build marker/u);
  });
});

describe('allowMissingIdentityMetadata (manifest-adapter compatibility)', () => {
  let warnSpy: ReturnType<typeof rstest.spyOn>;

  beforeEach(() => {
    warnSpy = rstest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('tolerates legacy exposes without identity metadata', async () => {
    const loaded = await loadBackendFederatedEffectApi({
      hostName: 'testHost',
      remote: {
        entry: 'static:verticalCatalogBackend',
        name: 'verticalCatalogBackend',
      },
      runtime: createStubRuntime(createLoadedModule(null)),
      expected,
      allowMissingIdentityMetadata: true,
    });
    expect(loaded.contract).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still rejects mismatching declared identity values', async () => {
    await expect(
      loadBackendFederatedEffectApi({
        hostName: 'testHost',
        remote: {
          entry: 'static:verticalCatalogBackend',
          name: 'verticalCatalogBackend',
        },
        runtime: createStubRuntime(
          createLoadedModule({ unitId: 'acme/other', build: 'stale' }),
        ),
        expected,
        allowMissingIdentityMetadata: true,
      }),
    ).rejects.toThrow(/delivery-unit identity mismatch/u);
  });
});
