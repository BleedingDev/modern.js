declare const ULTRAMODERN_BUILD_MARKER: string;
declare const ULTRAMODERN_SOURCE_REVISION: string;

interface BuildIdentity {
  readonly build: string;
  readonly buildMarker: string;
  readonly sourceRevision: string;
}

interface BuildArtifact {
  readonly deliveryUnit: BuildIdentity;
  readonly surfaces: {
    readonly api: BuildIdentity;
    readonly ui: BuildIdentity;
  };
}

/** Rspack injects these constants into every compiled delivery-unit surface. */
export function resolveUltramodernBuildArtifact<Artifact extends BuildArtifact>(
  artifact: Artifact,
) {
  const buildMarker =
    typeof ULTRAMODERN_BUILD_MARKER === 'string'
      ? ULTRAMODERN_BUILD_MARKER
      : artifact.deliveryUnit.buildMarker;
  const sourceRevision =
    typeof ULTRAMODERN_SOURCE_REVISION === 'string'
      ? ULTRAMODERN_SOURCE_REVISION
      : artifact.deliveryUnit.sourceRevision;
  const identity = { build: buildMarker, buildMarker, sourceRevision };
  return {
    ...artifact,
    deliveryUnit: { ...artifact.deliveryUnit, ...identity },
    surfaces: {
      api: { ...artifact.surfaces.api, ...identity },
      ui: { ...artifact.surfaces.ui, ...identity },
    },
  };
}
