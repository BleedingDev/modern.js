import { Schema } from 'effect';
import * as baseline from '../src/microvertical-api';

describe('micro-vertical API baseline', () => {
  test('pins OTel attribute keys, omitting traceId until one is provided', () => {
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
    expect(baseline.microVerticalOperationAttributes(context)).toEqual({
      'modernjs.operation.id': 'catalog.list',
      'modernjs.operation.method': 'GET',
      'modernjs.operation.route': '/catalog',
      'modernjs.operation.source': 'generated-client',
    });

    const withTrace = baseline.createMicroVerticalOperationContext({
      method: 'POST',
      operationId: 'catalog.create',
      routePath: '/catalog',
      traceId: 'trace-123',
    });
    expect(decode(withTrace)).toEqual(withTrace);
    expect(baseline.microVerticalOperationAttributes(withTrace)).toEqual({
      'modernjs.operation.id': 'catalog.create',
      'modernjs.operation.method': 'POST',
      'modernjs.operation.route': '/catalog',
      'modernjs.operation.source': 'generated-client',
      'modernjs.trace.id': 'trace-123',
    });
  });
});
