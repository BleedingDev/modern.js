import { createApiClient } from '../src/ultramodern-workspace/api/client';
import { createApiServiceEntry } from '../src/ultramodern-workspace/api/service';
import { createSharedApi } from '../src/ultramodern-workspace/api/shared';
import {
  createSharedContractsIndex,
  createSharedPackage,
} from '../src/ultramodern-workspace/package-json';
import { migratedWorkspaceScriptArtifacts } from '../src/ultramodern-workspace/workspace-scripts';

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
    expect(source).toContain(
      "from '@warehouse/shared-contracts/microvertical-api-baseline'",
    );
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
        './microvertical-api-baseline': './src/microvertical-api-baseline.ts',
        './server/effect-bff-runtime': './src/effect-bff-runtime.ts',
      },
      dependencies: {
        '@modern-js/plugin-bff': '3.9.0',
        effect: '4.0.0-rc.112',
      },
    });
    expect(createSharedContractsIndex()).not.toContain(
      'MicroVerticalReadinessSchema',
    );
    expect(createSharedContractsIndex()).not.toContain("from 'effect'");
    expect(createSharedContractsIndex()).not.toContain('export *');
    expect(createSharedContractsIndex()).not.toContain('defineEffectBff');
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
    ).toBe(true);
    const checker = artifacts.find(
      file =>
        file.relativePath === 'scripts/check-ultramodern-api-boundaries.mts',
    );
    expect(checker?.content).toContain('strictEffectRuntimeTopologyViolation');
    expect(checker?.content).toContain('microVerticalApiBaselineViolation');
  });
});
