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
