import {
  createLastKnownGoodProvider,
  type DiscoveryResult,
  type LkgStorage,
  type ResolvedDeliveryUnit,
  type SurfaceResolutionProvider,
} from '../../src/module-federation';

const record = (buildMarker: string): ResolvedDeliveryUnit => ({
  unitId: 'acme/checkout',
  buildMarker,
  sourceRevision: `rev-${buildMarker}`,
  baselineCohortId: 'cohort-1',
  surfaces: [
    {
      surfaceId: 'cart',
      kind: 'component',
      locations: [
        {
          platform: 'browser-mf-manifest',
          manifestUrl: `https://cdn/${buildMarker}.json`,
        },
      ],
    },
  ],
  compatibility: { status: 'compatible', baselineCohortId: 'cohort-1' },
});

const okResult = (buildMarker: string): DiscoveryResult => ({
  ok: true,
  unit: record(buildMarker),
});

const providerUnavailable = (
  refValue = 'acme/checkout#cart',
): DiscoveryResult => ({
  ok: false,
  error: {
    code: 'provider-unavailable',
    ref: refValue,
    message: 'offline',
  },
});

const ref = { unitId: 'acme/checkout', surfaceId: 'cart' };

const incompatibleResult = (buildMarker: string): DiscoveryResult => ({
  ok: true,
  unit: {
    ...record(buildMarker),
    compatibility: {
      status: 'incompatible',
      baselineCohortId: 'cohort-9',
      reason: 'baseline skew',
    },
  },
});

const degradedResult = (buildMarker: string): DiscoveryResult => ({
  ok: true,
  unit: {
    ...record(buildMarker),
    compatibility: {
      status: 'degraded',
      baselineCohortId: 'cohort-1',
      reason: 'provider recovered an incomplete upstream view',
    },
  },
});

const wrongSurfaceResult = (buildMarker: string): DiscoveryResult => ({
  ok: true,
  unit: {
    ...record(buildMarker),
    surfaces: [
      {
        surfaceId: 'banner',
        kind: 'component',
        locations: [
          {
            platform: 'browser-mf-manifest',
            manifestUrl: `https://cdn/${buildMarker}-banner.json`,
          },
        ],
      },
    ],
  },
});

/** Unwrap a successful result or fail the test with the typed error. */
const unitOf = (result: DiscoveryResult): ResolvedDeliveryUnit => {
  if (!result.ok) {
    throw new Error(`expected ok result, got ${result.error.code}`);
  }
  return result.unit;
};

/** A provider whose per-call result is scripted. */
const scriptedProvider = (
  script: Array<DiscoveryResult | (() => never)>,
): SurfaceResolutionProvider => {
  let i = 0;
  return {
    name: 'scripted',
    resolve() {
      const next = script[Math.min(i, script.length - 1)];
      i += 1;
      if (typeof next === 'function') {
        return next();
      }
      return next;
    },
  };
};

describe('G24a/b last-known-good provider wrapper', () => {
  test('serves the last complete record marked degraded on provider failure', async () => {
    const provider = scriptedProvider([
      okResult('bm-1'),
      okResult('bm-2'),
      providerUnavailable(),
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    const first = await lkg.resolve(ref, 'prod');
    expect(first.ok).toBe(true);

    const refreshed = await lkg.resolve(ref, 'prod');
    expect(refreshed.ok).toBe(true);
    expect(unitOf(refreshed).buildMarker).toBe('bm-2');

    const served = unitOf(await lkg.resolve(ref, 'prod'));
    // Whole prior record, only the verdict flipped.
    expect(served.buildMarker).toBe('bm-2');
    expect(served.sourceRevision).toBe('rev-bm-2');
    expect(served.surfaces).toEqual(record('bm-2').surfaces);
    expect(served.compatibility.status).toBe('degraded');
  });

  test('serves LKG when the wrapped provider throws', async () => {
    const provider = scriptedProvider([
      okResult('bm-1'),
      () => {
        throw new Error('boom');
      },
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    await lkg.resolve(ref, 'prod');
    const served = await lkg.resolve(ref, 'prod');
    expect(served.ok).toBe(true);
    expect(unitOf(served).compatibility.status).toBe('degraded');
  });

  test('expiry yields a typed stale-record error, never a partial record', async () => {
    let clock = 1_000;
    const provider = scriptedProvider([
      okResult('bm-1'),
      {
        ok: false,
        error: {
          code: 'provider-unavailable',
          ref: 'acme/checkout#cart',
          message: 'offline',
        },
      },
    ]);
    const lkg = createLastKnownGoodProvider({
      provider,
      freshness: { maxStaleMs: 5_000 },
      now: () => clock,
    });

    await lkg.resolve(ref, 'prod'); // stored at t=1000
    clock = 10_000; // age 9000ms > 5000ms
    const served = await lkg.resolve(ref, 'prod');

    expect(served.ok).toBe(false);
    expect(!served.ok && served.error.code).toBe('stale-record');
  });

  test('passes through the resolver failure when nothing is cached', async () => {
    const provider = scriptedProvider([
      {
        ok: false,
        error: {
          code: 'unknown-unit',
          ref: 'acme/checkout#cart',
          message: 'no such unit',
        },
      },
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    const served = await lkg.resolve(ref, 'prod');
    expect(!served.ok && served.error.code).toBe('unknown-unit');
  });

  test('an older overlapping resolution cannot replace a newer success', async () => {
    let completeOlder!: (result: DiscoveryResult) => void;
    let completeNewer!: (result: DiscoveryResult) => void;
    const older = new Promise<DiscoveryResult>(resolve => {
      completeOlder = resolve;
    });
    const newer = new Promise<DiscoveryResult>(resolve => {
      completeNewer = resolve;
    });
    let calls = 0;
    const provider: SurfaceResolutionProvider = {
      name: 'overlapping',
      resolve() {
        calls += 1;
        if (calls === 1) {
          return older;
        }
        if (calls === 2) {
          return newer;
        }
        return {
          ok: false,
          error: {
            code: 'provider-unavailable',
            ref: 'acme/checkout#cart',
            message: 'offline',
          },
        };
      },
    };
    const lkg = createLastKnownGoodProvider({ provider });

    const olderRequest = lkg.resolve(ref, 'prod');
    const newerRequest = lkg.resolve(ref, 'prod');
    completeNewer(okResult('bm-2'));
    await newerRequest;
    completeOlder(okResult('bm-1'));
    await olderRequest;

    const served = unitOf(await lkg.resolve(ref, 'prod'));
    expect(served.buildMarker).toBe('bm-2');
    expect(served.compatibility.status).toBe('degraded');
  });

  test('two surfaces of one unit share a single atomically-swapped snapshot', async () => {
    const multiSurfaceResult: DiscoveryResult = {
      ok: true,
      unit: {
        ...record('bm-1'),
        surfaces: [
          ...record('bm-1').surfaces,
          {
            surfaceId: 'banner',
            kind: 'component',
            locations: [
              {
                platform: 'browser-mf-manifest',
                manifestUrl: 'https://cdn/bm-1-banner.json',
              },
            ],
          },
        ],
      },
    };
    const provider = scriptedProvider([
      multiSurfaceResult,
      {
        ok: false,
        error: {
          code: 'provider-unavailable',
          ref: 'acme/checkout#banner',
          message: 'offline',
        },
      },
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    const cartRef = { unitId: 'acme/checkout', surfaceId: 'cart' };
    const bannerRef = { unitId: 'acme/checkout', surfaceId: 'banner' };

    // Resolving one surface caches the whole unit snapshot under (unitId, env).
    await lkg.resolve(cartRef, 'prod');
    // A different surface of the SAME unit, while the provider is down, is
    // served from that one shared snapshot — no mixed build markers.
    const served = await lkg.resolve(bannerRef, 'prod');
    expect(served.ok).toBe(true);
    expect(unitOf(served).buildMarker).toBe('bm-1');
    expect(unitOf(served).compatibility.status).toBe('degraded');
  });

  test('does not serve a cached unit that lacks the requested surface', async () => {
    const provider = scriptedProvider([
      okResult('bm-1'),
      {
        ok: false,
        error: {
          code: 'provider-unavailable',
          ref: 'acme/checkout#banner',
          message: 'offline',
        },
      },
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    await lkg.resolve(ref, 'prod');
    const served = await lkg.resolve(
      { unitId: 'acme/checkout', surfaceId: 'banner' },
      'prod',
    );

    expect(served.ok).toBe(false);
    expect(!served.ok && served.error.code).toBe('provider-unavailable');
  });

  test('versioned recovery rejects a provider that omits the required surface stamp', async () => {
    const versionedRef = { ...ref, major: 2 };
    const provider = scriptedProvider([
      okResult('bm-1'),
      {
        ok: false,
        error: {
          code: 'provider-unavailable',
          ref: 'acme/checkout#cart@v2',
          message: 'offline',
        },
      },
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    const unversioned = await lkg.resolve(versionedRef, 'prod');
    expect(unversioned.ok).toBe(false);
    expect(!unversioned.ok && unversioned.error.code).toBe('identity-mismatch');

    const served = await lkg.resolve(versionedRef, 'prod');
    expect(served.ok).toBe(false);
    expect(!served.ok && served.error.code).toBe('provider-unavailable');
  });

  test('an incompatible record is never cached nor served as last-known-good', async () => {
    const provider = scriptedProvider([
      incompatibleResult('bm-9'),
      providerUnavailable(),
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    // The incompatible success is returned live but never cached.
    const first = await lkg.resolve(ref, 'prod');
    expect(unitOf(first).compatibility.status).toBe('incompatible');
    // With nothing good cached, the provider failure passes through — the
    // incompatible record is never resurrected as a degraded LKG.
    const served = await lkg.resolve(ref, 'prod');
    expect(served.ok).toBe(false);
    expect(!served.ok && served.error.code).toBe('provider-unavailable');
  });

  test.each([
    {
      expectedRefreshBuildMarker: 'bm-2',
      expectedRefreshStatus: 'incompatible',
      name: 'incompatible',
      refresh: incompatibleResult('bm-2'),
    },
    {
      expectedRefreshBuildMarker: 'bm-2',
      expectedRefreshStatus: 'degraded',
      name: 'degraded',
      refresh: degradedResult('bm-2'),
    },
    {
      expectedRefreshBuildMarker: 'bm-1',
      expectedRefreshStatus: 'degraded',
      name: 'wrong-surface',
      refresh: wrongSurfaceResult('bm-2'),
    },
  ])('$name refresh cannot replace the last good record', async scenario => {
    const provider = scriptedProvider([
      okResult('bm-1'),
      scenario.refresh,
      providerUnavailable(),
    ]);
    const lkg = createLastKnownGoodProvider({ provider });

    await lkg.resolve(ref, 'prod');
    const refresh = unitOf(await lkg.resolve(ref, 'prod'));
    expect(refresh.buildMarker).toBe(scenario.expectedRefreshBuildMarker);
    expect(refresh.compatibility.status).toBe(scenario.expectedRefreshStatus);

    const served = unitOf(await lkg.resolve(ref, 'prod'));
    expect(served.buildMarker).toBe('bm-1');
    expect(served.compatibility.status).toBe('degraded');
  });

  test('persists a complete record through a pluggable storage hook', async () => {
    const backing = new Map<string, unknown>();
    const storage: LkgStorage = {
      read: key => backing.get(key) as never,
      write: (key, value) => {
        backing.set(key, value);
      },
    };
    const lkg = createLastKnownGoodProvider({
      provider: scriptedProvider([okResult('bm-1')]),
      storage,
    });

    await lkg.resolve(ref, 'prod');
    const reopened = createLastKnownGoodProvider({
      provider: scriptedProvider([providerUnavailable()]),
      storage,
    });
    const served = await reopened.resolve(ref, 'prod');
    expect(served.ok).toBe(true);
    expect(unitOf(served).buildMarker).toBe('bm-1');
    expect(unitOf(served).compatibility.status).toBe('degraded');
  });
});
