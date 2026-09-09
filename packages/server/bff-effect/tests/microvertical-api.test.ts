import { Schema } from 'effect';
import * as baseline from '../src/microvertical-api';

const marker = {
  appId: 'catalog',
  build: 'production',
  buildMarker: 'catalog:abc123',
  deployProfile: 'cloudflare',
  packageName: '@shop/catalog',
  sourceRevision: 'abc123',
  surface: 'rest',
  unitId: 'catalog-unit',
  version: '1.0.0',
};

const readiness = {
  checks: {
    api: 'ready',
    moduleFederation: 'ready',
    ssr: 'ready',
    translations: 'ready',
  },
  marker,
  status: 'ready',
  versionSkew: 'none',
};

describe('micro-vertical API baseline', () => {
  test('exposes only the six public runtime exports', () => {
    expect(Object.keys(baseline).sort()).toEqual(
      [
        'MicroVerticalBuildMarkerSchema',
        'MicroVerticalReadinessSchema',
        'MicroVerticalOperationSourceSchema',
        'MicroVerticalOperationContextSchema',
        'createMicroVerticalOperationContext',
        'microVerticalOperationAttributes',
      ].sort(),
    );
  });

  test('decodes branded IDs as strings and round-trips build markers', () => {
    const decoded = Schema.decodeUnknownSync(
      baseline.MicroVerticalBuildMarkerSchema,
    )(marker);
    expect(decoded).toEqual(marker);
    expect(
      Schema.encodeSync(baseline.MicroVerticalBuildMarkerSchema)(decoded),
    ).toEqual(marker);
    expect(() =>
      Schema.decodeUnknownSync(baseline.MicroVerticalBuildMarkerSchema)({
        ...marker,
        appId: 42,
      }),
    ).toThrow();
  });

  test('allows consumer readiness composition and rejects incomplete health', () => {
    const composed = Schema.Struct({
      ...baseline.MicroVerticalReadinessSchema.fields,
      database: Schema.Literal('ready'),
    });
    expect(
      Schema.decodeUnknownSync(composed)({ ...readiness, database: 'ready' }),
    ).toEqual({ ...readiness, database: 'ready' });
    for (const check of Object.keys(readiness.checks)) {
      expect(() =>
        Schema.decodeUnknownSync(baseline.MicroVerticalReadinessSchema)({
          ...readiness,
          checks: { ...readiness.checks, [check]: 'failed' },
        }),
      ).toThrow();
    }
    expect(() =>
      Schema.decodeUnknownSync(baseline.MicroVerticalReadinessSchema)({
        ...readiness,
        versionSkew: 'detected',
      }),
    ).toThrow();
  });

  test('preserves the accepted operation sources', () => {
    const decode = Schema.decodeUnknownSync(
      baseline.MicroVerticalOperationSourceSchema,
    );
    for (const source of [
      'client',
      'server',
      'generated-client',
      'effect-adapter',
      'data-platform',
      'unknown',
    ]) {
      expect(decode(source)).toBe(source);
    }
    expect(() => decode('unrecognized')).toThrow();
  });

  test('constructs generated-client context without introducing trace metadata', () => {
    const context = baseline.createMicroVerticalOperationContext({
      method: 'GET',
      operationId: 'catalog.list',
      routePath: '/catalog',
    });
    expect(context).toEqual({
      method: 'GET',
      operationId: 'catalog.list',
      routePath: '/catalog',
      source: 'generated-client',
    });
    expect(Object.hasOwn(context, 'traceId')).toBe(false);
    const decode = Schema.decodeUnknownSync(
      baseline.MicroVerticalOperationContextSchema,
    );
    expect(decode(context)).toEqual(context);
    expect(() => decode({ ...context, traceId: undefined })).toThrow();
    expect(baseline.microVerticalOperationAttributes(context)).toEqual({
      'modernjs.operation.id': 'catalog.list',
      'modernjs.operation.method': 'GET',
      'modernjs.operation.route': '/catalog',
      'modernjs.operation.source': 'generated-client',
    });
  });

  test('retains provided trace IDs and exact attribute keys', () => {
    const context = baseline.createMicroVerticalOperationContext({
      method: 'POST',
      operationId: 'catalog.create',
      routePath: '/catalog',
      traceId: 'trace-123',
    });
    expect(
      Schema.decodeUnknownSync(baseline.MicroVerticalOperationContextSchema)(
        context,
      ),
    ).toEqual(context);
    expect(baseline.microVerticalOperationAttributes(context)).toEqual({
      'modernjs.operation.id': 'catalog.create',
      'modernjs.operation.method': 'POST',
      'modernjs.operation.route': '/catalog',
      'modernjs.operation.source': 'generated-client',
      'modernjs.trace.id': 'trace-123',
    });
  });
});
