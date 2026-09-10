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

const readers = {
  buildMarker: () => 'compiled-build',
  sourceRevision: () => 'compiled-revision',
};

it('applies injected identity to every surface without mutating the artifact', () => {
  const resolved = resolveUltramodernBuildArtifact(artifact, readers);
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

it('falls back only for missing compiler references and preserves each supplied value', () => {
  expect(resolveUltramodernBuildArtifact(artifact)).toEqual(artifact);

  const result = resolveUltramodernBuildArtifact(artifact, {
    buildMarker: readers.buildMarker,
    sourceRevision: () => {
      throw new ReferenceError('ULTRAMODERN_SOURCE_REVISION is not defined');
    },
  });
  expect(result.deliveryUnit.buildMarker).toBe('compiled-build');
  expect(result.deliveryUnit.sourceRevision).toBe('workspace');
  const failure = new Error('reader failed');
  expect(() =>
    resolveUltramodernBuildArtifact(artifact, {
      ...readers,
      buildMarker: () => {
        throw failure;
      },
    }),
  ).toThrow(failure);
});
