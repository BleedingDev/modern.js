import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { addUltramodernVertical } from '../src/ultramodern-workspace';
import { createApiClient } from '../src/ultramodern-workspace/api/client';
import { createApiServiceEntry } from '../src/ultramodern-workspace/api/service';
import { createSharedApi } from '../src/ultramodern-workspace/api/shared';
import { readFileTemplate } from '../src/ultramodern-workspace/fs-io';
import {
  createSharedContractsIndex,
  createSharedPackage,
} from '../src/ultramodern-workspace/package-json';
import { migratedWorkspaceScriptArtifacts } from '../src/ultramodern-workspace/workspace-scripts';
import { createWorkspace } from './helpers/workspace-kit';

const service = {
  id: 'inventory-stock',
  api: { consumedBy: [], prefix: '/warehouse-api', stem: 'warehouse-items' },
};

describe('scope-aware native API scaffolding', () => {
  test('MicroVertical templates use the shared strict Effect BFF assembly primitive', () => {
    const source = createApiServiceEntry(service, '../shared/api.ts', {
      scope: 'warehouse',
    });
    expect(source).toContain(
      "from '@warehouse/shared-contracts/server/effect-bff-runtime'",
    );
    expect(source).toContain('const apiHandlersLive = Layer.mergeAll(');
    expect(source).toContain('handlers: apiHandlersLive');
    expect(source).toContain('makeWarehouseItemsApiRuntime');
    expect(source).toContain("'foundation'");
    expect(source).not.toContain('defineEffectBff');
    expect(source).not.toContain('@fixture/');
    expect(source).toContain('Effect.fail(notFound)');
  });
  test('standalone callers keep a direct native definition without guessing a scope', () => {
    const source = createApiServiceEntry(service, '../shared/api.ts');
    expect(source).toContain(
      'defineEffectBff({ api: warehouseItemsApi, layer })',
    );
    expect(source).not.toContain('shared-contracts');
  });
  test('scoped clients address foundation readiness while standalone clients keep their group', () => {
    expect(
      createApiClient(service, '../../shared/api', { scope: 'warehouse' }),
    ).toContain('client.foundation.readiness({})');
    expect(createApiClient(service, '../../shared/api')).toContain(
      'client.warehouseItems.readiness({})',
    );
  });
  test('shared API baseline retains owner metadata and custom prefixes', () => {
    const source = createSharedApi(service, { scope: 'warehouse' });
    expect(source).toContain("from '@modern-js/bff-effect/microvertical-api'");
    expect(source).toContain('= MicroVerticalReadinessSchema');
    expect(source).toContain('= MicroVerticalBuildMarkerSchema');
    expect(source).toContain('.addHttpApi(warehouseItemsFoundationApi)');
    expect(source).toContain('readiness: createMicroVerticalOperationContext(');
    expect(source).toContain("ownerId: 'inventory-stock'");
    expect(source).toContain(
      "readinessPath: '/warehouse-api/warehouse-items/readiness'",
    );
  });
  test('shared package exports server assembly separately and keeps RC112', () => {
    const manifest = createSharedPackage(
      'warehouse',
      'shared-contracts',
      'Contracts',
      { strategy: 'install', modernPackageVersion: '3.9.0' },
    );
    expect(manifest).toMatchObject({
      exports: {
        './server/effect-bff-runtime': './src/effect-bff-runtime.ts',
      },
      dependencies: {
        '@modern-js/bff-effect': '3.9.0',
        '@modern-js/plugin-bff': '3.9.0',
        '@modern-js/runtime-extensions': '3.9.0',
        effect: '4.0.0-rc.112',
      },
    });
    expect(createSharedContractsIndex()).not.toContain(
      'MicroVerticalReadinessSchema',
    );
    expect(createSharedContractsIndex()).not.toContain("from 'effect'");
    expect(createSharedContractsIndex()).toContain(
      "export * from '@modern-js/runtime-extensions/workspace-events';",
    );
    expect(createSharedContractsIndex()).not.toContain('@modern-js/bff-effect');
    expect(createSharedContractsIndex()).not.toContain('defineEffectBff');
    // Git checkout EOL does not change this native two-declaration contract.
    expect(
      readFileTemplate('packages/effect-bff-runtime.ts').split(/\r?\n/u),
    ).toEqual([
      "export { assembleEffectBffRuntime } from '@modern-js/bff-effect/assembly';",
      "export type { EffectBffRuntimeAssembly } from '@modern-js/bff-effect/assembly';",
      '',
    ]);
  });
  test('migration emits the owning AST helper rather than a consumer customization', () => {
    const artifacts = migratedWorkspaceScriptArtifacts({
      hasBackendSurface: true,
      shellOnly: false,
    });
    expect(
      artifacts.some(
        file =>
          file.relativePath ===
          'scripts/microvertical-api-baseline-boundary.mts',
      ),
    ).toBe(false);
    const checker = artifacts.find(
      file =>
        file.relativePath === 'scripts/check-ultramodern-api-boundaries.mts',
    );
    expect(checker).toBeUndefined();
  });
});

const MODERN_VERSION = '3.2.1';

function linkGeneratedWorkspacePackages(
  workspaceDir: string,
  scope: string,
): void {
  const rootNodeModules = path.resolve(
    __dirname,
    '../../../../node_modules/.pnpm/node_modules',
  );
  const nodeModules = path.join(workspaceDir, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });

  for (const entry of fs.readdirSync(rootNodeModules)) {
    const source = path.join(rootNodeModules, entry);
    const destination = path.join(nodeModules, entry);
    if (!fs.existsSync(destination)) {
      fs.symlinkSync(source, destination, 'junction');
    }
  }

  const generatedScope = path.join(nodeModules, `@${scope}`);
  fs.mkdirSync(generatedScope, { recursive: true });
  fs.symlinkSync(
    path.join(workspaceDir, 'packages/shared-contracts'),
    path.join(generatedScope, 'shared-contracts'),
    'junction',
  );
}

test('a generated REST API serves a request through its shared contract', () => {
  const packageName = 'w23-api-request';
  const { tempRoot, workspaceDir } = createWorkspace(packageName, {
    tempPrefix: 'um-api-request-',
  });

  try {
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: MODERN_VERSION,
    });
    linkGeneratedWorkspacePackages(workspaceDir, packageName);

    const result = spawnSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(
          path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
        ).href,
        '--input-type=module',
        '--eval',
        `const loaded = await import('./api/index.ts');
const runtime = loaded.default?.default ?? loaded.default;
const webHandler = runtime.createHandler();
try {
  const response = await webHandler.handler(new Request('https://catalog.example/catalog?limit=1'));
  process.stdout.write('\\n__RESULT__' + JSON.stringify({ status: response.status, body: await response.json() }));
} finally {
  await webHandler.dispose();
}`,
      ],
      {
        cwd: path.join(workspaceDir, 'verticals/catalog'),
        encoding: 'utf-8',
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const response = JSON.parse(result.stdout.split('__RESULT__').at(-1) ?? '');
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.items.map(
        ({ id, title }: { id: string; title: string }) => ({
          id,
          title,
        }),
      ),
      [{ id: 'starter-catalog', title: 'Wire a real catalog source here' }],
    );
    assert.equal(response.body.items[0].marker.appId, 'catalog');
    assert.equal(
      response.body.items[0].marker.unitId,
      'w23-api-request/catalog',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
