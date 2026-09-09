import {
  createUltramodernBuildArtifact,
  type DeliveryUnitRecord,
} from '@modern-js/utils/universal';
import { createDeliveryUnitRecord } from '../delivery-unit';
import { appEmitsBrowserUi, appHasApi } from '../descriptors';
import type { WorkspaceApp } from '../types';

function deliveryUnitRecordFor(scope: string, app: WorkspaceApp) {
  return app.deliveryUnit
    ? (app.deliveryUnit as unknown as DeliveryUnitRecord)
    : createDeliveryUnitRecord(scope, app);
}

export function createUltramodernBuildArtifactJson(
  scope: string,
  app: WorkspaceApp,
): string {
  const record = deliveryUnitRecordFor(scope, app);
  return `${JSON.stringify(createUltramodernBuildArtifact(record), null, 2)}\n`;
}

export function createUltramodernBuildModule(
  scope: string,
  app: WorkspaceApp,
  includeUiMarker = appEmitsBrowserUi(app),
): string {
  const record = deliveryUnitRecordFor(scope, app);
  return `import { resolveUltramodernBuildArtifact } from '@modern-js/runtime-extensions/build-identity';

declare const ULTRAMODERN_BUILD_MARKER: string;
declare const ULTRAMODERN_SOURCE_REVISION: string;

const ultramodernBuildArtifact = resolveUltramodernBuildArtifact(${JSON.stringify(
    createUltramodernBuildArtifact(record),
    null,
    2,
  )} as const, {
  buildMarker: () => ULTRAMODERN_BUILD_MARKER,
  sourceRevision: () => ULTRAMODERN_SOURCE_REVISION,
});

export const ultramodernDeliveryUnit = ultramodernBuildArtifact.deliveryUnit;
${includeUiMarker ? 'export const ultramodernUiMarker = ultramodernBuildArtifact.surfaces.ui;\n' : ''}${app.kind !== 'shell' && appHasApi(app) ? 'export const ultramodernApiMarker = ultramodernBuildArtifact.surfaces.api;\n' : ''}`;
}

export function createUltramodernBuildReexportModule(
  app: WorkspaceApp,
  includeUiMarker = appEmitsBrowserUi(app),
): string {
  const names = ['ultramodernDeliveryUnit'];
  if (includeUiMarker) names.push('ultramodernUiMarker');
  if (app.kind !== 'shell' && appHasApi(app))
    names.push('ultramodernApiMarker');
  return `export { ${names.join(', ')} } from '../shared/ultramodern-build';\n`;
}
