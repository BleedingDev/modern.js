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
  options: typeof expectation & { sharedContractsDirectory: string },
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
  additionalPaths: { checkoutCartPath: '/warehouse-api/warehouse-items/cart' },
  apiPrefix: '/warehouse-api',
  basePath: '/warehouse-api/warehouse-items',
  effectClientPackage: '@modern-js/plugin-bff/effect-client',
  ownerId: 'inventory-stock',
  readinessPath: '/warehouse-api/warehouse-items/readiness',
  sharedContractsPackage: '@warehouse/shared-contracts',
};
const source = createSharedApi(service, { scope: 'warehouse' });
const validate = (content: string, customize?: (owner: string) => void) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'shared-api-baseline-'),
  );
  try {
    const file = path.join(directory, 'api.ts');
    fs.writeFileSync(file, content);
    const owner = path.join(directory, 'packages/shared-contracts');
    fs.mkdirSync(path.join(owner, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(owner, 'package.json'),
      JSON.stringify({
        name: expectation.sharedContractsPackage,
        exports: {
          '.': './src/index.ts',
          './microvertical-api-baseline': './src/microvertical-api-baseline.ts',
        },
      }),
    );
    fs.writeFileSync(
      path.join(owner, 'src/index.ts'),
      'export const business = true;\n',
    );
    fs.copyFileSync(
      path.resolve(
        __dirname,
        '../templates/packages/microvertical-api-baseline.ts',
      ),
      path.join(owner, 'src/microvertical-api-baseline.ts'),
    );
    const publicPackage = path.join(
      directory,
      'node_modules',
      expectation.sharedContractsPackage,
    );
    fs.mkdirSync(path.dirname(publicPackage), { recursive: true });
    fs.symlinkSync(owner, publicPackage, 'dir');
    customize?.(owner);
    return microVerticalApiBaselineViolation('warehouse-items', file, {
      ...expectation,
      sharedContractsDirectory: owner,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

describe('native shared API baseline AST', () => {
  test('accepts scoped readiness foundation with independent owner and prefix', () => {
    expect(validate(source)).toBeUndefined();
  });
  test('checks optional sample endpoint metadata without requiring consumer APIs to implement it', () => {
    const withCart = source.replace(
      "ownerId: 'inventory-stock'",
      "checkoutCartPath: '/warehouse-api/warehouse-items/cart', ownerId: 'inventory-stock'",
    );
    expect(withCart).not.toBe(source);
    expect(validate(withCart)).toBeUndefined();
    expect(
      validate(
        withCart.replace(
          "checkoutCartPath: '/warehouse-api/warehouse-items/cart'",
          "checkoutCartPath: '/foreign/cart'",
        ),
      ),
    ).toBeDefined();
    expect(
      validate(
        source.replace(
          "ownerId: 'inventory-stock'",
          "unknownPath: '/foreign', ownerId: 'inventory-stock'",
        ),
      ),
    ).toBeDefined();
  });
  test('accepts legacy root only when the exact owner exports its baseline', () => {
    const legacy = source.replaceAll(
      '/shared-contracts/microvertical-api-baseline',
      '/shared-contracts',
    );
    expect(validate(legacy)).toBeDefined();
    expect(
      validate(legacy, owner => {
        fs.writeFileSync(
          path.join(owner, 'src/index.ts'),
          "export * from './microvertical-api-baseline.ts';\n",
        );
      }),
    ).toBeUndefined();
    expect(
      validate(legacy, owner => {
        fs.copyFileSync(
          path.join(owner, 'src/microvertical-api-baseline.ts'),
          path.join(owner, 'src/index.ts'),
        );
      }),
    ).toBeUndefined();
  });
  test('rejects an explicit impersonated schema overriding a genuine root star export', () => {
    const legacy = source.replaceAll(
      '/shared-contracts/microvertical-api-baseline',
      '/shared-contracts',
    );
    expect(
      validate(legacy, owner => {
        fs.writeFileSync(
          path.join(owner, 'src/index.ts'),
          [
            "export * from './microvertical-api-baseline.ts';",
            'const fake = {};',
            'export { fake as MicroVerticalBuildMarkerSchema };',
          ].join('\n'),
        );
      }),
    ).toBeDefined();
  });
  test.each([
    './src/impersonated.ts',
    './src/index.ts',
  ])('rejects remapped dedicated baseline export %s', target => {
    expect(
      validate(source, owner => {
        fs.copyFileSync(
          path.join(owner, 'src/microvertical-api-baseline.ts'),
          path.join(owner, 'src/impersonated.ts'),
        );
        fs.writeFileSync(
          path.join(owner, 'package.json'),
          JSON.stringify({
            name: expectation.sharedContractsPackage,
            exports: { './microvertical-api-baseline': target },
          }),
        );
      }),
    ).toBeDefined();
  });
  test('rejects a same-named installed package impersonating the expected owner', () => {
    expect(
      validate(source, owner => {
        const root = path.resolve(owner, '../..');
        const impersonator = path.join(root, 'impersonator');
        fs.cpSync(owner, impersonator, { recursive: true });
        const link = path.join(
          root,
          'node_modules',
          expectation.sharedContractsPackage,
        );
        fs.unlinkSync(link);
        fs.symlinkSync(impersonator, link, 'dir');
      }),
    ).toBeDefined();
  });
  test('rejects missing public primitives and foreign package identity', () => {
    expect(
      validate(source, owner => {
        fs.writeFileSync(
          path.join(owner, 'src/microvertical-api-baseline.ts'),
          'export const unrelated = true;',
        );
      }),
    ).toBeDefined();
    expect(
      validate(source, owner => {
        const manifestPath = path.join(owner, 'package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.name = '@foreign/shared-contracts';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      }),
    ).toBeDefined();
  });
  test.each([
    [
      'arbitrary package subpath',
      '/shared-contracts/microvertical-api-baseline',
      '/shared-contracts/impersonated',
    ],
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
