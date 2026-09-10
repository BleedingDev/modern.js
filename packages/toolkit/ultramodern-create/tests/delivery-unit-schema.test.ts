import assert from 'node:assert/strict';
import type {
  BaselineCohort,
  ParsedSurfaceRef,
  SurfaceRefParseError,
} from '../src/ultramodern-workspace/delivery-unit-schema/types';
import {
  formatSurfaceRef,
  parseDeliveryUnitDescriptor,
  parseSurfaceRef,
  resolvePublicationZone,
  serializeDeliveryUnitDescriptor,
} from '../src/ultramodern-workspace/delivery-unit-schema/types';

const baselineCohort: BaselineCohort = {
  cohortId: 'baseline-2026-07',
  resolved: {
    react: '^19.2.7',
    tanstackRouter: '1.170.17',
    effect: '4.0.0-beta.102',
    tailwind: '4.3.3',
  },
};

/* -------------------------------------------------------------------------- */
/* SurfaceRef parse / format round-trips                                       */
/* -------------------------------------------------------------------------- */

test('SurfaceRef round-trips canonical forms', () => {
  const canonical = [
    'checkout#cart',
    'acme/checkout#cart',
    'acme/checkout#cart@v2',
    'a.b-c_d/e#surface_1@v10',
  ];
  for (const input of canonical) {
    const result = parseSurfaceRef(input);
    assert.equal(result.ok, true, `expected ${input} to parse`);
    if (result.ok) {
      assert.equal(formatSurfaceRef(result.ref), input);
    }
  }
});

test('SurfaceRef parses fields correctly', () => {
  const withMajor = parseSurfaceRef('acme/checkout#cart@v2');
  assert.deepEqual(withMajor.ok && withMajor.ref, {
    unitId: 'acme/checkout',
    surfaceId: 'cart',
    major: 2,
  } satisfies ParsedSurfaceRef);

  const noMajor = parseSurfaceRef('checkout#cart');
  assert.deepEqual(noMajor.ok && noMajor.ref, {
    unitId: 'checkout',
    surfaceId: 'cart',
  } satisfies ParsedSurfaceRef);
});

test('SurfaceRef rejects invalid forms with typed errors', () => {
  const cases: Array<[string, SurfaceRefParseError['code']]> = [
    ['', 'empty'],
    ['checkout', 'missing-surface-separator'],
    ['a#b#c', 'multiple-surface-separators'],
    ['#cart', 'empty-unit-id'],
    ['acme//checkout#cart', 'invalid-unit-id'],
    ['acme/che kout#cart', 'invalid-unit-id'],
    ['checkout#', 'empty-surface-id'],
    ['checkout#ca rt', 'invalid-surface-id'],
    ['checkout#cart@', 'empty-major'],
    ['checkout#cart@2', 'invalid-major'],
    ['checkout#cart@v0', 'invalid-major'],
    ['checkout#cart@v01', 'invalid-major'],
    ['checkout#cart@vx', 'invalid-major'],
    ['checkout#cart@v9007199254740992', 'invalid-major'],
  ];
  for (const [input, code] of cases) {
    const result = parseSurfaceRef(input);
    assert.equal(result.ok, false, `expected ${input} to fail`);
    if (!result.ok) {
      assert.equal(result.error.code, code, `wrong error code for ${input}`);
    }
  }
});

test('SurfaceRef formatter rejects direct inputs outside the canonical invariant', () => {
  const cases: Array<[ParsedSurfaceRef, SurfaceRefParseError['code']]> = [
    [{ unitId: 'acme//checkout', surfaceId: 'cart' }, 'invalid-unit-id'],
    [
      { unitId: 'acme/checkout', surfaceId: 'cart route' },
      'invalid-surface-id',
    ],
    [{ unitId: 'acme/checkout', surfaceId: 'cart', major: 0 }, 'invalid-major'],
    [
      { unitId: 'acme/checkout', surfaceId: 'cart', major: 1.5 },
      'invalid-major',
    ],
    [
      {
        unitId: 'acme/checkout',
        surfaceId: 'cart',
        major: Number.MAX_SAFE_INTEGER + 1,
      },
      'invalid-major',
    ],
  ];

  for (const [ref, code] of cases) {
    assert.throws(
      () => formatSurfaceRef(ref),
      new RegExp(`Cannot format invalid SurfaceRef: ${code}`),
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Publication zone default                                                    */
/* -------------------------------------------------------------------------- */

test('publication zone defaults to coordinated', () => {
  assert.deepEqual(resolvePublicationZone(undefined), { zone: 'coordinated' });
  assert.deepEqual(
    resolvePublicationZone({
      zone: 'external',
      external: { surfaceMajor: 2, baselineCompatibility: 'baseline-2026-07' },
    }),
    {
      zone: 'external',
      external: { surfaceMajor: 2, baselineCompatibility: 'baseline-2026-07' },
    },
  );
});

/* -------------------------------------------------------------------------- */
/* Unknown-field preservation (round-trip parse -> serialize)                  */
/* -------------------------------------------------------------------------- */

test('parse -> serialize preserves unknown top-level and surface fields', () => {
  const json = {
    unitId: 'acme/checkout',
    kind: 'microvertical',
    owner: { kind: 'team', id: 'checkout' },
    sourceRevision: 'rev-1',
    buildMarker: 'marker-1',
    baselineCohort,
    futureUnitField: { experimental: true },
    surfaces: [
      {
        kind: 'component',
        surfaceId: 'cart',
        locations: [
          { platform: 'browser-mf', manifestUrl: 'https://c/mf.json' },
        ],
        futureSurfaceField: 'preserve-me',
      },
    ],
  };

  const parsed = parseDeliveryUnitDescriptor(json);
  assert.deepEqual(parsed.unknownFields, {
    futureUnitField: { experimental: true },
  });
  assert.deepEqual(parsed.surfaces[0]?.unknownFields, {
    futureSurfaceField: 'preserve-me',
  });

  const serialized = serializeDeliveryUnitDescriptor(parsed);
  assert.deepEqual(serialized, json);
});

test('parse leaves unknownFields absent when there are none', () => {
  const json = {
    unitId: 'acme/checkout',
    kind: 'microvertical',
    owner: { kind: 'team', id: 'checkout' },
    sourceRevision: 'rev-1',
    buildMarker: 'marker-1',
    baselineCohort,
    surfaces: [],
  };
  const parsed = parseDeliveryUnitDescriptor(json);
  assert.equal(parsed.unknownFields, undefined);
  assert.deepEqual(serializeDeliveryUnitDescriptor(parsed), json);
});
