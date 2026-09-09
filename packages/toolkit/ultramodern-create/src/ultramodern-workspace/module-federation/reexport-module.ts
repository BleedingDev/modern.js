import { createUltramodernBuildArtifact } from '@modern-js/utils/universal';
import { createDeliveryUnitRecord } from '../delivery-unit';
import { appEmitsBrowserUi, appHasApi } from '../descriptors';
import type { WorkspaceApp } from '../types';

export function createUltramodernBuildArtifactJson(
  scope: string,
  app: WorkspaceApp,
): string {
  const record = createDeliveryUnitRecord(scope, app);
  const artifact = createUltramodernBuildArtifact(record);
  return `${JSON.stringify(
    {
      ...artifact,
      deliveryUnit: { ...record, ...artifact.deliveryUnit },
      surfaces: {
        api: { ...record, ...artifact.surfaces.api },
        ui: { ...record, ...artifact.surfaces.ui },
      },
    },
    null,
    2,
  )}\n`;
}

export function createUltramodernBuildModule(
  _scope: string,
  app: WorkspaceApp,
  includeUiMarker = appEmitsBrowserUi(app),
): string {
  return `import buildArtifact from './ultramodern-build.json' with { type: 'json' };
import { resolveUltramodernBuildArtifact } from '@modern-js/runtime-extensions/build-identity';

declare const ULTRAMODERN_BUILD_MARKER: string;
declare const ULTRAMODERN_SOURCE_REVISION: string;

const ultramodernBuildArtifact = resolveUltramodernBuildArtifact(buildArtifact, {
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
