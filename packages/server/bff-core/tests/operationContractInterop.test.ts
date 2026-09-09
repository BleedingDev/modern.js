import {
  buildOperationContractMap,
  type OperationContractSource,
  serializeOperationSchemas,
} from '@modern-js/server-runtime-extensions/bff-policy/node';
import { z } from 'zod';
import { Api, Data, Headers, Params, Query, Upload } from '../src';
import type { APIHandlerInfo, ApiHandler } from '../src/router/types';
import { HttpMetadata, HttpMethod } from '../src/types';

type PolicyHandler = NonNullable<OperationContractSource['handler']>;

// These assignments pin both callable directions without importing native
// implementation or types from the lower policy owner's source or tests.
const toPolicyHandler = (handler: ApiHandler): PolicyHandler => handler;
const toNativeHandler = (handler: PolicyHandler): ApiHandler => handler;
const toPolicySource = (source: APIHandlerInfo): OperationContractSource =>
  source;

test('canonical policy reads every schema slot from real native operators', () => {
  const schemas = {
    DATA: z.object({ data: z.string() }),
    QUERY: z.object({ query: z.string() }),
    PARAMS: z.object({ params: z.string() }),
    HEADERS: z.object({ headers: z.string() }),
    Files: z.object({ file: z.string() }),
  };
  const handler = Api(
    Data(schemas.DATA),
    Query(schemas.QUERY),
    Params(schemas.PARAMS),
    Headers(schemas.HEADERS),
    Upload('/upload', schemas.Files),
    async () => ({ ok: true }),
  );

  expect(toNativeHandler(toPolicyHandler(handler))).toBe(handler);
  const serialized = serializeOperationSchemas(handler);
  expect(Object.keys(serialized ?? {})).toEqual([
    HttpMetadata.Data,
    HttpMetadata.Query,
    HttpMetadata.Params,
    HttpMetadata.Headers,
    HttpMetadata.Files,
  ]);
  for (const [key, property] of [
    ['DATA', 'data'],
    ['QUERY', 'query'],
    ['PARAMS', 'params'],
    ['HEADERS', 'headers'],
    ['Files', 'file'],
  ] as const) {
    expect(serialized?.[key]).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: { [property]: { type: 'string' } },
        required: [property],
      }),
    );
    expect(Reflect.getMetadata(key, handler)).toBe(schemas[key]);
  }
});

test('native reflected sources retain handler identity and independent hashes', () => {
  const handler = Api(Data(z.object({ value: z.string() })), async () => 'ok');
  const source: APIHandlerInfo = {
    handler,
    name: 'createItem',
    httpMethod: HttpMethod.Post,
    routeName: '/items',
    routePath: '/api/items',
    filename: 'api/items.ts',
  };
  const policySource = toPolicySource(source);
  expect(policySource).toBe(source);
  expect(toNativeHandler(policySource.handler!)).toBe(handler);

  const before = buildOperationContractMap({
    handlers: [policySource],
    requestId: 'catalog',
    operationVersion: 3,
  });
  const after = buildOperationContractMap({
    handlers: [
      { ...policySource, name: 'otherItem', routePath: '/api/other' },
      policySource,
    ],
    requestId: 'catalog',
    operationVersion: 3,
  });
  expect(after['POST:/api/items']).toEqual(before['POST:/api/items']);
  expect(after['operation:catalog:createItem']).toBe(after['POST:/api/items']);
  expect(after['POST:/api/items']).toMatchObject({
    requestId: 'catalog',
    operationVersion: 3,
    filename: 'api/items.ts',
  });
  expect(policySource.handler).toBe(handler);
});
