import fs from 'node:fs';
import path from 'node:path';

import { ULTRAMODERN_CONFIG_PATH } from '../../ultramodern-workspace/descriptors';
import { readJsonObject } from './json';
import {
  normalizeCompactConfig,
  normalizeWorkspaceInputs,
  type UltramodernWorkspaceInputs,
} from './normalize';
import type { UltramodernToolingConfig } from './types';

export function readUltramodernConfig(
  workspaceRoot = process.cwd(),
): UltramodernToolingConfig {
  const { sourcePath, config } = readCompactInputs(workspaceRoot);
  return normalizeCompactConfig(workspaceRoot, sourcePath, config);
}

export function readUltramodernWorkspaceInputs(
  workspaceRoot = process.cwd(),
  inputs: Omit<UltramodernWorkspaceInputs, 'config'> = {},
) {
  const { sourcePath, config } = readCompactInputs(workspaceRoot);
  return normalizeWorkspaceInputs(
    workspaceRoot,
    { ...inputs, config },
    sourcePath,
  );
}

function readCompactInputs(workspaceRoot: string) {
  const compactPath = path.join(workspaceRoot, ULTRAMODERN_CONFIG_PATH);
  if (fs.existsSync(compactPath)) {
    return { sourcePath: compactPath, config: readJsonObject(compactPath) };
  }

  throw new Error(
    `Missing UltraModern config. Expected ${ULTRAMODERN_CONFIG_PATH}.`,
  );
}
