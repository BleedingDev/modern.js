import fs from 'node:fs';
import path from 'node:path';
import { appEmitsBrowserUi } from '../../../ultramodern-workspace/descriptors';
import {
  createUltramodernBuildArtifactJson,
  createUltramodernBuildModule,
  createUltramodernBuildReexportModule,
} from '../../../ultramodern-workspace/module-federation';
import {
  allWorkspaceAppsFromToolingConfig,
  type UltramodernToolingConfig,
} from '../../config';
import { type MigrationIo } from './io';

const legacyApiMarkerPattern =
  /export const ultramodernApiMarker\s*=\s*\{[\s\S]*?\}\s+as const;\n?/u;
const markerSchemaPattern =
  /(export const [A-Za-z_$][\w$]*MarkerSchema(?:\s*:[^=]+)?\s*=\s*Schema\.Struct\(\{\n)([\s\S]*?)(\n\}\);)/u;

export function rewriteLegacyApiMarkerBinding(source: string): string {
  return source.replace(
    legacyApiMarkerPattern,
    "export { ultramodernApiMarker } from './ultramodern-build.ts';\n",
  );
}

export function rewriteApiMarkerIdentitySchema(source: string): string {
  const match = source.match(markerSchemaPattern);
  if (!match) {
    return source;
  }
  let body = match[2];
  if (
    ![
      'appId',
      'build',
      'deployProfile',
      'packageName',
      'surface',
      'version',
    ].every(field =>
      new RegExp(`^\\s+${field}: Schema\\.String,\\s*$`, 'mu').test(body),
    )
  ) {
    return source;
  }
  for (const [anchor, field] of [
    ['build', 'buildMarker'],
    ['packageName', 'sourceRevision'],
    ['surface', 'unitId'],
  ]) {
    if (!new RegExp(`^\\s+${field}: Schema\\.String,\\s*$`, 'mu').test(body)) {
      body = body.replace(
        new RegExp(`^(\\s+)${anchor}: Schema\\.String,\\s*$`, 'mu'),
        `$&\n$1${field}: Schema.String,`,
      );
    }
  }
  return source.replace(
    markerSchemaPattern,
    (_full, prefix: string, _body: string, suffix: string) =>
      `${prefix}${body}${suffix}`,
  );
}

export function updateGeneratedBuildIdentityModules(
  io: MigrationIo,
  config: UltramodernToolingConfig,
) {
  for (const configuredApp of allWorkspaceAppsFromToolingConfig(config)) {
    const artifactPath = path.join(
      io.workspaceRoot,
      configuredApp.directory,
      'shared/ultramodern-build.json',
    );
    const previousArtifact = fs.existsSync(artifactPath)
      ? JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
      : undefined;
    const app = {
      ...configuredApp,
      deliveryUnit: {
        ...configuredApp.deliveryUnit,
        ...previousArtifact?.deliveryUnit,
      },
    };
    const sharedApiPath = path.join(
      io.workspaceRoot,
      app.directory,
      'shared/api.ts',
    );
    if (app.api && fs.existsSync(sharedApiPath)) {
      io.write(
        sharedApiPath,
        rewriteApiMarkerIdentitySchema(
          rewriteLegacyApiMarkerBinding(
            fs.readFileSync(sharedApiPath, 'utf-8'),
          ),
        ),
      );
    }
    const reexportPath = path.join(
      io.workspaceRoot,
      app.directory,
      'src/ultramodern-build.ts',
    );
    const includeUiMarker =
      appEmitsBrowserUi(app) &&
      (app.kind !== 'shell' || fs.existsSync(reexportPath));
    if (fs.existsSync(reexportPath)) {
      io.writeGenerated(
        reexportPath,
        createUltramodernBuildReexportModule(app, includeUiMarker),
      );
    }
    io.writeGenerated(
      path.join(io.workspaceRoot, app.directory, 'shared/ultramodern-build.ts'),
      createUltramodernBuildModule(
        config.workspace.packageScope,
        app,
        includeUiMarker,
      ),
    );
    const projected = JSON.parse(
      createUltramodernBuildArtifactJson(config.workspace.packageScope, app),
    );
    const artifact = previousArtifact
      ? {
          ...previousArtifact,
          ...projected,
          deliveryUnit: {
            ...previousArtifact.deliveryUnit,
            ...projected.deliveryUnit,
          },
          surfaces: {
            ...previousArtifact.surfaces,
            api: {
              ...previousArtifact.surfaces?.api,
              ...projected.surfaces.api,
            },
            ui: { ...previousArtifact.surfaces?.ui, ...projected.surfaces.ui },
          },
        }
      : projected;
    // Existing delivery identity is consumer data, distinct from the framework
    // release. Avoid even a formatting write when its projection is unchanged.
    if (
      !previousArtifact ||
      JSON.stringify(previousArtifact) !== JSON.stringify(artifact)
    ) {
      io.write(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    }
  }
}
