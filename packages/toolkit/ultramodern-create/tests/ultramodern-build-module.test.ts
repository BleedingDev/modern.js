import assert from 'node:assert/strict';
import { createDeliveryUnitRecord } from '../src/ultramodern-workspace/delivery-unit';
import { createNeutralOwnership } from '../src/ultramodern-workspace/descriptors';
import { createUltramodernBuildModule } from '../src/ultramodern-workspace/module-federation/reexport-module';
import type { WorkspaceApp } from '../src/ultramodern-workspace/types';
import { evaluateBuildModule } from './helpers/build-module';

const app: WorkspaceApp = {
  api: {
    consumedBy: ['shell-super-app', 'catalog'],
    prefix: '/catalog-api',
    stem: 'catalog',
  },
  directory: 'verticals/catalog',
  displayName: 'Catalog Vertical',
  domain: 'catalog',
  exposes: {
    './Widget': 'src/components/catalog-widget.tsx',
  },
  id: 'catalog',
  kind: 'vertical',
  mfName: 'verticalCatalog',
  ownership: createNeutralOwnership('catalog'),
  packageSuffix: 'catalog',
  port: 3021,
  portEnv: 'VERTICAL_CATALOG_PORT',
};

test('generated build module applies one compiled identity to UI, API, and delivery-unit records', () => {
  const source = createUltramodernBuildModule('acme', app);
  const generationRecord = createDeliveryUnitRecord('acme', app);
  const execute = (globals: Record<string, string>) => {
    const exports = evaluateBuildModule(source, globals);
    assert.deepEqual(Object.keys(exports).sort(), [
      'ultramodernApiMarker',
      'ultramodernDeliveryUnit',
      'ultramodernUiMarker',
    ]);
    return {
      deliveryUnit: exports.ultramodernDeliveryUnit,
      surfaces: {
        api: exports.ultramodernApiMarker,
        ui: exports.ultramodernUiMarker,
      },
    };
  };
  const fallback = execute({});
  assert.equal(fallback.deliveryUnit.buildMarker, generationRecord.buildMarker);
  assert.equal(fallback.deliveryUnit.sourceRevision, 'workspace');

  const compiledIdentity = execute({
    ULTRAMODERN_BUILD_MARKER: 'compiled-marker',
    ULTRAMODERN_SOURCE_REVISION: 'compiled-revision',
  });
  for (const identity of [
    compiledIdentity.deliveryUnit,
    compiledIdentity.surfaces.api,
    compiledIdentity.surfaces.ui,
  ]) {
    assert.equal(identity.build, 'compiled-marker');
    assert.equal(identity.buildMarker, 'compiled-marker');
    assert.equal(identity.sourceRevision, 'compiled-revision');
  }
});

test('shell build modules expose delivery identity without unused UI or API markers', () => {
  const source = createUltramodernBuildModule('acme', {
    ...app,
    kind: 'shell',
  });
  assert.match(source, /export const ultramodernDeliveryUnit/u);
  assert.doesNotMatch(source, /export const ultramodern(?:Ui|Api)Marker/u);
  assert.doesNotMatch(source, /typeof|surfaces: \{[\s\S]*surfaces:/u);
});
