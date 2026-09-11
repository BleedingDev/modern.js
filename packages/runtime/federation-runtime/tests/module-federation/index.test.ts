import {
  classifyModuleFederationFallback,
  consumeSurface,
  createLastKnownGoodProvider,
  type DiscoveryResult,
  ModuleFederationRemoteComponentContractError,
  ModuleFederationRemoteLoadError,
  ModuleFederationRemoteLoadTimeoutError,
  type ResolvedDeliveryUnit,
} from '../../src/module-federation';

describe('module federation degraded telemetry', () => {
  test('classifies deterministic fallback reasons', () => {
    expect(
      classifyModuleFederationFallback(
        new ModuleFederationRemoteLoadTimeoutError('remote/Widget', 20),
      ),
    ).toBe('timeout');
    expect(
      classifyModuleFederationFallback(new Error('failed to fetch chunk')),
    ).toBe('network');
    expect(
      classifyModuleFederationFallback(
        new ModuleFederationRemoteComponentContractError(
          'remote/Widget',
          'default',
        ),
      ),
    ).toBe('contract');
    expect(
      classifyModuleFederationFallback(
        new Error('@tanstack/react-router requiredVersion mismatch'),
      ),
    ).toBe('version-skew');
    expect(
      classifyModuleFederationFallback(
        new ModuleFederationRemoteLoadError(
          'remote/Widget',
          1,
          new Error('manifest not found'),
        ),
      ),
    ).toBe('remote-unavailable');
  });
});

const cartUnit = (): ResolvedDeliveryUnit => ({
  unitId: 'acme/checkout',
  buildMarker: 'bm-1',
  sourceRevision: 'rev-1',
  baselineCohortId: 'cohort-1',
  surfaces: [
    {
      surfaceId: 'cart',
      kind: 'component',
      locations: [
        {
          platform: 'browser-mf-manifest',
          manifestUrl: 'https://cdn/mf-manifest.json',
        },
      ],
    },
  ],
  compatibility: { status: 'compatible', baselineCohortId: 'cohort-1' },
});

const offline: DiscoveryResult = {
  ok: false,
  error: {
    code: 'provider-unavailable',
    ref: 'acme/checkout#cart',
    message: 'offline',
  },
};

describe('degraded remote consumption', () => {
  test('an unavailable remote renders the fallback instead of throwing', async () => {
    const value = await consumeSurface<string>({
      ref: 'acme/checkout#cart',
      env: 'prod',
      appName: 'shell',
      classification: 'noncritical',
      provider: { name: 'offline', resolve: () => offline },
      load: () => 'live',
      degraded: () => 'fallback-ui',
    });

    expect(value).toBe('fallback-ui');
  });

  test('last-known-good serves the previous record marked degraded', async () => {
    let calls = 0;
    const lkg = createLastKnownGoodProvider({
      provider: {
        name: 'scripted',
        resolve: () => {
          calls += 1;
          return calls === 1 ? { ok: true, unit: cartUnit() } : offline;
        },
      },
    });
    const ref = { unitId: 'acme/checkout', surfaceId: 'cart' };

    await lkg.resolve(ref, 'prod');
    const served = await lkg.resolve(ref, 'prod');

    expect(served.ok).toBe(true);
    expect(served.ok && served.unit.buildMarker).toBe('bm-1');
    expect(served.ok && served.unit.compatibility.status).toBe('degraded');
  });
});
