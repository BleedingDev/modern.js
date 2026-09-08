import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { createSharedApi } from '../src/ultramodern-workspace/api/shared';

const require = createRequire(import.meta.url);
let helperDirectory: string;
let microVerticalApiBaselineViolation: (
  stem: string,
  file: string,
  options: typeof expectation,
) => string | undefined;

beforeAll(() => {
  // Exercise the shipped template with its generated-workspace dependency name,
  // not a test-only source import that resolves through this package's dev aliases.
  helperDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'shared-api-helper-'),
  );
  const helperPath = path.join(helperDirectory, 'baseline.mts');
  fs.copyFileSync(
    path.resolve(
      __dirname,
      '../templates/workspace-scripts/microvertical-api-baseline-boundary.mts',
    ),
    helperPath,
  );
  const scope = path.join(helperDirectory, 'node_modules/@typescript');
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(
    path.dirname(require.resolve('typescript/package.json')),
    path.join(scope, 'native'),
    'dir',
  );
  ({ microVerticalApiBaselineViolation } = require(helperPath));
});
afterAll(() => {
  if (helperDirectory) {
    fs.rmSync(helperDirectory, { recursive: true, force: true });
  }
});

const service = {
  id: 'inventory-stock',
  api: { consumedBy: [], prefix: '/warehouse-api', stem: 'warehouse-items' },
};
const expectation = {
  additionalPaths: {},
  apiPrefix: '/warehouse-api',
  basePath: '/warehouse-api/warehouse-items',
  effectClientPackage: '@modern-js/plugin-bff/effect-client',
  ownerId: 'inventory-stock',
  readinessPath: '/warehouse-api/warehouse-items/readiness',
  sharedContractsPackage: '@warehouse/shared-contracts',
};
const source = createSharedApi(service, { scope: 'warehouse' });
const validate = (content: string) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'shared-api-baseline-'),
  );
  try {
    const file = path.join(directory, 'api.ts');
    fs.writeFileSync(file, content);
    return microVerticalApiBaselineViolation(
      'warehouse-items',
      file,
      expectation,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

describe('native shared API baseline AST', () => {
  test('accepts scoped readiness foundation with independent owner and prefix', () => {
    expect(validate(source)).toBeUndefined();
  });
  test.each([
    ['fake primitive import', '  HttpApi,', '  fake as HttpApi,'],
    [
      'foreign shared scope',
      '@warehouse/shared-contracts',
      '@foreign/shared-contracts',
    ],
    ['discarded foundation', '.addHttpApi(warehouseItemsFoundationApi)', ''],
    ['wrong owner', "ownerId: 'inventory-stock'", "ownerId: 'foreign-stock'"],
    [
      'wrong readiness path',
      "readinessPath: '/warehouse-api/warehouse-items/readiness'",
      "readinessPath: '/other/readiness'",
    ],
    [
      'unconstructed operation',
      'readiness: createMicroVerticalOperationContext(',
      'readiness: fake(',
    ],
    [
      'replaced marker schema',
      '= MicroVerticalBuildMarkerSchema',
      '= Schema.String',
    ],
    [
      'replaced readiness schema',
      '= MicroVerticalReadinessSchema',
      '= Schema.String',
    ],
  ])('rejects %s without trusting comments or strings', (_label, before, after) => {
    expect(source).toContain(before);
    const modified = source.replace(before, after);
    expect(
      validate(
        `${modified}\n/* ${source} */\nconst decoy = ${JSON.stringify(source)};`,
      ),
    ).toBeDefined();
  });
});
