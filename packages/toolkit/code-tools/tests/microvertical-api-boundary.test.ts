import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSharedApi } from '../../ultramodern-create/src/ultramodern-workspace/api/shared';
import { runMicroVerticalApiCheckCli } from '../src/cli/microvertical-api-check';
import {
  checkMicroVerticalApiBoundaries,
  checkMicroVerticalApiConsumerFiles,
  type MicroVerticalApiBaselineExpectation,
  microVerticalApiBaselineViolation,
} from '../src/microvertical-api-boundary';

const baseline = '@modern-js/bff-effect/microvertical-api';
const exportsSource = `export const MicroVerticalBuildMarkerSchema = {}; export const MicroVerticalReadinessSchema = {}; export const createMicroVerticalOperationContext = input => input;`;
const contract = `import { HttpApi, HttpApiEndpoint, HttpApiGroup, Schema } from '@modern-js/bff-effect/effect-client';
import { MicroVerticalBuildMarkerSchema, MicroVerticalReadinessSchema, createMicroVerticalOperationContext } from '${baseline}';
export const catalogMarkerSchema = MicroVerticalBuildMarkerSchema;
export const catalogReadinessSchema = MicroVerticalReadinessSchema;
export const catalogFoundationApi = HttpApi.make('CatalogFoundationApi').add(HttpApiGroup.make('foundation').add(HttpApiEndpoint.get('readiness', '/catalog/readiness', { success: catalogReadinessSchema })));
export const catalogApi = HttpApi.make('CatalogApi').addHttpApi(catalogFoundationApi);
export const catalogOperationContexts = { readiness: createMicroVerticalOperationContext({method: 'GET', operationId: 'CatalogApi:/catalog/readiness', routePath: '/catalog/readiness'}) } as const;
export const catalogApiContract = { apiPrefix: '/catalog-api', basePath: '/catalog-api/catalog', ownerId: 'catalog', readinessPath: '/catalog-api/catalog/readiness' } as const;`;
const entry = `import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/bff-effect/effect-edge'; import { catalogApi } from '../shared/api.ts'; const handlers = HttpApiBuilder.group(catalogApi, 'foundation', h => h.handle('readiness', () => undefined)); const layer = HttpApiBuilder.layer(catalogApi).pipe(Layer.provide(handlers)); export default defineEffectBff({api: catalogApi, layer});`;
let root: string;
let owner: string;
let file: string;
let expectation: MicroVerticalApiBaselineExpectation;
const write = (file: string, source: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-tools-api-boundary-'));
  owner = path.join(root, 'node_modules/@modern-js/bff-effect');
  write(
    path.join(owner, 'package.json'),
    JSON.stringify({
      name: '@modern-js/bff-effect',
      type: 'module',
      exports: {
        './microvertical-api': {
          types: './types.d.ts',
          import: './index.js',
          require: './index.js',
        },
      },
    }),
  );
  write(path.join(owner, 'index.js'), exportsSource);
  file = path.join(root, 'verticals/catalog/shared/api.ts');
  write(file, contract);
  write(
    path.join(root, '.modernjs/ultramodern.json'),
    JSON.stringify({
      topology: {
        apps: [
          {
            id: 'catalog',
            path: 'verticals/catalog',
            kind: 'vertical',
            api: {},
          },
        ],
      },
    }),
  );
  write(path.join(root, 'verticals/catalog/api/index.ts'), entry);
  write(
    path.join(root, 'verticals/catalog/src/api/catalog-client.ts'),
    `import { Effect, makeEffectHttpApiClient } from '@modern-js/bff-effect/effect-client'; import { catalogApi } from '../../shared/api'; export const client = makeEffectHttpApiClient(catalogApi);`,
  );
  expectation = {
    additionalPaths: {},
    apiPrefix: '/catalog-api',
    basePath: '/catalog-api/catalog',
    ownerId: 'catalog',
    readinessPath: '/catalog-api/catalog/readiness',
    effectClientPackage: '@modern-js/bff-effect/effect-client',
    baselinePackage: baseline,
    baselinePackageDirectory: owner,
  };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const validate = (source = contract) => {
  write(file, source);
  return microVerticalApiBaselineViolation('catalog', file, expectation);
};

test('checks consumer composition without inspecting framework implementation', () => {
  expect(validate()).toBeUndefined();
  expect(
    validate(
      contract.replaceAll("'", '"').replaceAll(';', '; /* formatting */'),
    ),
  ).toBeUndefined();
  expect(
    validate(
      contract
        .replace(
          '= MicroVerticalBuildMarkerSchema;',
          '= Schema.Struct({...MicroVerticalBuildMarkerSchema.fields});',
        )
        .replace(
          '= MicroVerticalReadinessSchema;',
          '= Schema.Struct({...MicroVerticalReadinessSchema.fields, marker: catalogMarkerSchema});',
        ),
    ),
  ).toBeUndefined();
});
test.each([
  ["ownerId: 'catalog'", "ownerId: 'foreign'", 'metadata'],
  ["method: 'GET'", "method: 'POST'", 'operation map'],
  [
    "operationId: 'CatalogApi:/catalog/readiness'",
    "operationId: 'ForeignApi:/catalog/readiness'",
    'operation map',
  ],
  [
    '.addHttpApi(catalogFoundationApi)',
    '.add(catalogFoundationApi)',
    'compose',
  ],
  ['success: catalogReadinessSchema', 'success: Schema.Unknown', 'foundation'],
  [
    '= MicroVerticalBuildMarkerSchema;',
    '= Schema.Struct({...MicroVerticalBuildMarkerSchema.fields, version: Schema.String});',
    'build marker',
  ],
  [
    '= MicroVerticalReadinessSchema;',
    '= Schema.Struct({...MicroVerticalReadinessSchema.fields, status: Schema.String, marker: catalogMarkerSchema});',
    'readiness schema',
  ],
  [
    'MicroVerticalReadinessSchema, createMicroVerticalOperationContext }',
    'fake as MicroVerticalReadinessSchema, createMicroVerticalOperationContext }',
    'exact baseline',
  ],
  [
    "from '@modern-js/bff-effect/microvertical-api'",
    "from 'foreign'",
    'exact baseline',
  ],
])('rejects %s', (before, after, reason) =>
  expect(validate(contract.replace(before, after))).toContain(reason));
test('additional metadata remains caller-owned', () => {
  expectation = {
    ...expectation,
    additionalPaths: { searchPath: '/catalog-api/catalog/search' },
  };
  expect(validate()).toBeUndefined();
  expect(
    validate(
      contract.replace(
        "ownerId: 'catalog'",
        "searchPath: '/catalog-api/catalog/search', ownerId: 'catalog'",
      ),
    ),
  ).toBeUndefined();
  expect(
    validate(
      contract.replace(
        "ownerId: 'catalog'",
        "searchPath: '/foreign', ownerId: 'catalog'",
      ),
    ),
  ).toContain('metadata');
});
test('accepts bounded barrels but rejects foreign, renamed, ambiguous and cyclic exports', () => {
  write(path.join(owner, 'index.js'), "export * from './barrel.js';");
  write(
    path.join(owner, 'barrel.js'),
    "export { MicroVerticalBuildMarkerSchema, MicroVerticalReadinessSchema, createMicroVerticalOperationContext } from './owner.js';",
  );
  write(path.join(owner, 'owner.js'), exportsSource);
  expect(validate()).toBeUndefined();
  for (const source of [
    "export * from 'foreign';",
    "export * from './owner.js'; const fake = {}; export { fake as MicroVerticalReadinessSchema };",
    "export * from './owner.js'; export * from './decoy.js';",
    "export * from './index.js';",
  ]) {
    write(path.join(owner, 'barrel.js'), source);
    write(path.join(owner, 'decoy.js'), exportsSource);
    expect(validate()).toContain('exact framework owner');
  }
});
test('rejects nested package decoys and escaping symlinks, accepts owner symlink', () => {
  const nested = path.join(
    root,
    'verticals/catalog/node_modules/@modern-js/bff-effect',
  );
  fs.mkdirSync(path.dirname(nested), { recursive: true });
  fs.symlinkSync(owner, nested);
  expect(validate()).toBeUndefined();
  fs.unlinkSync(nested);
  fs.cpSync(owner, nested, { recursive: true });
  expect(validate()).toContain('exact framework owner');
  fs.rmSync(nested, { recursive: true });
  write(path.join(root, 'outside.js'), exportsSource);
  fs.rmSync(path.join(owner, 'index.js'));
  fs.symlinkSync(path.join(root, 'outside.js'), path.join(owner, 'index.js'));
  expect(validate()).toContain('exact framework owner');
});
test('consumer syntax and binding errors are violations; owner parser failures throw', () => {
  expect(validate(`${contract}\nexport const invalid = ;`)).toContain(
    'valid TypeScript syntax',
  );
  expect(validate(`${contract}\nconst Schema = {};`)).toContain(
    'valid TypeScript syntax',
  );
  expect(validate(`${contract}\ncatalogApi = foreign;`)).toContain(
    'valid TypeScript syntax',
  );
  write(path.join(owner, 'index.js'), 'export const = ;');
  expect(() => validate()).toThrow();
});
test('full and files phases run topology once and zero times respectively', () => {
  expect(checkMicroVerticalApiBoundaries({ workspaceRoot: root })).toEqual({
    diagnostics: [],
    toolErrors: [],
    topologyFilesAnalyzed: 1,
  });
  expect(checkMicroVerticalApiConsumerFiles({ workspaceRoot: root })).toEqual({
    diagnostics: [],
    toolErrors: [],
    topologyFilesAnalyzed: 0,
  });
  write(
    path.join(root, 'verticals/catalog/api/index.ts'),
    entry.replace('export default defineEffectBff', 'defineEffectBff'),
  );
  expect(
    checkMicroVerticalApiBoundaries({ workspaceRoot: root }).diagnostics.join(
      '\n',
    ),
  ).toContain('verticals/catalog/api/index.ts');
  expect(
    checkMicroVerticalApiConsumerFiles({ workspaceRoot: root }).diagnostics,
  ).toEqual([]);
});
test('config errors and missing owners fail closed as tool failures', () => {
  write(path.join(root, '.modernjs/ultramodern.json'), '{');
  expect(
    checkMicroVerticalApiBoundaries({ workspaceRoot: root }).toolErrors.length,
  ).toBe(1);
  expect(
    checkMicroVerticalApiBoundaries({
      workspaceRoot: root,
      configuredApps: [{ path: '../escape' }],
    }).toolErrors.length,
  ).toBe(1);
  fs.rmSync(owner, { recursive: true });
  expect(
    checkMicroVerticalApiBoundaries({
      workspaceRoot: root,
      baselinePackageDirectory: owner,
      configuredApps: [
        { path: 'verticals/catalog', kind: 'vertical', api: {} },
      ],
    }).toolErrors.join('\n'),
  ).toContain('verticals/catalog');
});
test('CLI distinguishes success, consumer and infrastructure failures', () => {
  expect(runMicroVerticalApiCheckCli(['--workspace-root', root])).toBe(0);
  write(file, contract.replace("ownerId: 'catalog'", "ownerId: 'foreign'"));
  expect(runMicroVerticalApiCheckCli(['--workspace-root', root])).toBe(1);
  write(path.join(root, '.modernjs/ultramodern.json'), '{');
  expect(runMicroVerticalApiCheckCli(['--workspace-root', root])).toBe(2);
  expect(runMicroVerticalApiCheckCli(['--workspace-root'])).toBe(2);
});
test('UI-only units reject API surfaces', () => {
  const result = checkMicroVerticalApiConsumerFiles({
    workspaceRoot: root,
    configuredApps: [
      {
        path: 'verticals/catalog',
        kind: 'vertical',
        surfaceProfile: 'ui-only',
      },
    ],
  });
  expect(result.toolErrors).toEqual([]);
  expect(result.diagnostics.join('\n')).toContain('unit has no API surface');
});

test('legacy operation mappings are explicit and business-agnostic', () => {
  const source = contract.replace(
    'readiness: createMicroVerticalOperationContext',
    "reindex: createMicroVerticalOperationContext({method: 'POST', operationId: 'CatalogApi:catalog:reindex', routePath: '/catalog/reindex'}), readiness: createMicroVerticalOperationContext",
  );
  expect(validate(source)).toContain('operation map');
  expectation = {
    ...expectation,
    operationPaths: { 'CatalogApi:catalog:reindex': '/catalog/reindex' },
  };
  expect(validate(source)).toBeUndefined();
  expect(
    validate(
      source.replace("routePath: '/catalog/reindex'", "routePath: '/foreign'"),
    ),
  ).toContain('operation map');
});

test('public barrel and consumer source budgets fail as tool errors', () => {
  for (let index = 0; index < 66; index += 1)
    write(
      path.join(owner, index === 0 ? 'index.js' : `barrel${index}.js`),
      `export * from './barrel${index + 1}.js';`,
    );
  write(path.join(owner, 'barrel66.js'), exportsSource);
  expect(() => validate()).toThrow('budget');
  write(file, ' '.repeat(1_000_001));
  expect(() =>
    microVerticalApiBaselineViolation('catalog', file, expectation),
  ).toThrow('budget');
});
test('explicit owner directory supports isolated installation but cannot override consumer identity', () => {
  const result = checkMicroVerticalApiBoundaries({
    workspaceRoot: root,
    baselinePackageDirectory: owner,
  });
  expect(result.toolErrors).toEqual([]);
  expect(result.diagnostics).toEqual([]);
  const fake = path.join(root, 'fake-owner');
  fs.cpSync(owner, fake, { recursive: true });
  expect(
    checkMicroVerticalApiBoundaries({
      workspaceRoot: root,
      baselinePackageDirectory: fake,
    }).diagnostics.join('\n'),
  ).toContain('exact framework owner');
});
test('classifies RPC surfaces and validates native RPC topology', () => {
  fs.rmSync(file);
  fs.rmSync(path.join(root, 'verticals/catalog/src/api/catalog-client.ts'));
  write(
    path.join(root, 'verticals/catalog/shared/rpc.ts'),
    `import { Rpc, RpcGroup } from 'effect/unstable/rpc'; import { Schema } from '@modern-js/bff-effect/effect-client'; export const CatalogRpcGroup = RpcGroup.make(Rpc.make('ping', { success: Schema.Struct({}) }));`,
  );
  write(
    path.join(root, 'verticals/catalog/src/api/catalog-rpc-client.ts'),
    `import { Effect, makeEffectRpcClient } from '@modern-js/bff-effect/effect-client'; import { CatalogRpcGroup } from '../../shared/rpc.ts'; export const client = makeEffectRpcClient(CatalogRpcGroup);`,
  );
  write(
    path.join(root, 'verticals/catalog/api/index.ts'),
    `import { defineEffectBff, Effect, HttpApi, Layer } from '@modern-js/bff-effect/effect-edge'; import { CatalogRpcGroup } from '../shared/rpc.ts'; const CatalogRpcLayer = CatalogRpcGroup.toLayer(CatalogRpcGroup.of({ ping: () => undefined })); const apiRuntime = defineEffectBff({api: HttpApi.make('CatalogRpcApi'), layer: Layer.empty, rpc: { group: CatalogRpcGroup, layer: CatalogRpcLayer, path: '/rpc', serialization: 'json' }}); export default apiRuntime;`,
  );
  const result = checkMicroVerticalApiBoundaries({
    workspaceRoot: root,
    configuredApps: [
      { path: 'verticals/catalog', kind: 'vertical', api: { protocol: 'rpc' } },
    ],
  });
  expect(result).toEqual({
    diagnostics: [],
    toolErrors: [],
    topologyFilesAnalyzed: 1,
  });
});

test.each([
  'catalog',
  'checkout',
])('preserves actual generated %s public operation IDs without config copies', stem => {
  const service = {
    id: stem,
    api: { consumedBy: [], prefix: `/${stem}-api`, stem },
  };
  const generated = createSharedApi(service, { scope: 'fixture' });
  write(file, generated);
  const expected = {
    ...expectation,
    apiPrefix: `/${stem}-api`,
    basePath: `/${stem}-api/${stem}`,
    ownerId: stem,
    readinessPath: `/${stem}-api/${stem}/readiness`,
  };
  expect(
    microVerticalApiBaselineViolation(stem, file, expected),
  ).toBeUndefined();
  const operationId =
    stem === 'checkout'
      ? 'CheckoutApi:checkout:getCart'
      : 'CatalogApi:catalog:list';
  expect(generated).toContain(operationId);
  write(file, generated.replace(operationId, `${operationId}Wrong`));
  expect(microVerticalApiBaselineViolation(stem, file, expected)).toContain(
    'operation map',
  );
  write(file, generated.replace("method: 'POST'", "method: 'GET'"));
  expect(microVerticalApiBaselineViolation(stem, file, expected)).toContain(
    'operation map',
  );
  write(
    file,
    generated.replace(`routePath: '/${stem}'`, "routePath: '/foreign'"),
  );
  expect(microVerticalApiBaselineViolation(stem, file, expected)).toContain(
    'operation map',
  );
  if (stem === 'checkout') {
    write(
      file,
      generated.replace(
        "checkoutCartPath: '/checkout-api/checkout/cart'",
        "checkoutCartPath: '/checkout-api/checkout/cartoon'",
      ),
    );
    expect(microVerticalApiBaselineViolation(stem, file, expected)).toContain(
      'metadata',
    );
  }
});

test('infers non-cart operations only from reachable named native endpoint groups', () => {
  const source = contract
    .replace(
      'export const catalogApi =',
      "const searchEndpoint = HttpApiEndpoint.post('reindex', '/catalog/search/reindex', { success: Schema.String }); const searchGroup = HttpApiGroup.make('search').add(searchEndpoint); export const catalogApi =",
    )
    .replace(
      '.addHttpApi(catalogFoundationApi);',
      '.addHttpApi(catalogFoundationApi).add(searchGroup);',
    )
    .replace(
      'readiness: createMicroVerticalOperationContext',
      "reindex: createMicroVerticalOperationContext({method: 'POST', operationId: 'CatalogApi:search:reindex', routePath: '/catalog/search/reindex'}), readiness: createMicroVerticalOperationContext",
    )
    .replace(
      "ownerId: 'catalog'",
      "searchPath: '/catalog-api/catalog/search', ownerId: 'catalog'",
    );
  expect(validate(source)).toBeUndefined();
  for (const [before, after] of [
    ["method: 'POST'", "method: 'GET'"],
    [
      "routePath: '/catalog/search/reindex'",
      "routePath: '/catalog/search/missing'",
    ],
    ['CatalogApi:search:reindex', 'CatalogApi:catalog:reindex'],
    ["HttpApiEndpoint.post('reindex'", "HttpApiEndpoint.post('decoy'"],
    [
      "searchPath: '/catalog-api/catalog/search'",
      "searchPath: '/catalog-api/catalog/sear'",
    ],
    ['.add(searchGroup)', ''],
  ])
    expect(validate(source.replace(before, after))).toBeDefined();
  // A correct-looking but disconnected endpoint must not lend identity to a connected wrong verb.
  expect(
    validate(
      source.replace(
        "HttpApiEndpoint.post('reindex'",
        "HttpApiEndpoint.get('reindex'",
      ) +
        "\nconst disconnected = HttpApiEndpoint.post('reindex', '/catalog/search/reindex', {success: Schema.String});",
    ),
  ).toContain('operation map');
});
