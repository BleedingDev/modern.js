import path from 'node:path';
import { createZeropsYaml } from '../../../ultramodern-workspace/zerops';
import {
  allWorkspaceAppsFromToolingConfig,
  type UltramodernToolingConfig,
} from '../../config';
import { type MigrationIo } from './io';

export function updateGeneratedZeropsArtifacts(
  io: MigrationIo,
  config: UltramodernToolingConfig,
) {
  const apps = allWorkspaceAppsFromToolingConfig(config);
  io.writeGenerated(
    path.join(io.workspaceRoot, 'zerops.yaml'),
    `${createZeropsYaml(config.workspace.packageScope, apps)}\n`,
  );
}
