import { resolveUltramodernBuildArtifact } from '../src/buildIdentity';

const artifact = {
  deliveryUnit: {
    build: 'original',
    buildMarker: 'original',
    sourceRevision: 'workspace',
    unitId: 'shop/catalog',
  },
  surfaces: {
    api: {
      build: 'original',
      buildMarker: 'original',
      sourceRevision: 'workspace',
      surface: 'api',
    },
    ui: {
      build: 'original',
      buildMarker: 'original',
      sourceRevision: 'workspace',
      surface: 'ui',
    },
  },
} as const;

afterEach(() => rstest.unstubAllGlobals());

it('retains generation identity when the module is evaluated without a compiler', () => {
  expect(resolveUltramodernBuildArtifact(artifact)).toEqual(artifact);
});

it('applies injected identity to every surface without mutating the artifact', () => {
  rstest.stubGlobal('ULTRAMODERN_BUILD_MARKER', 'compiled-build');
  rstest.stubGlobal('ULTRAMODERN_SOURCE_REVISION', 'compiled-revision');
  const resolved = resolveUltramodernBuildArtifact(artifact);
  for (const record of [
    resolved.deliveryUnit,
    resolved.surfaces.api,
    resolved.surfaces.ui,
  ]) {
    expect(record).toMatchObject({
      build: 'compiled-build',
      buildMarker: 'compiled-build',
      sourceRevision: 'compiled-revision',
    });
  }
  expect(resolved.deliveryUnit.unitId).toBe('shop/catalog');
  expect(resolved.surfaces.api.surface).toBe('api');
  expect(resolved.surfaces.ui.surface).toBe('ui');
  expect(artifact.deliveryUnit.buildMarker).toBe('original');
});
