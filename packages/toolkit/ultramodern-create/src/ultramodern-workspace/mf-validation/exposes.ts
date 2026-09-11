import fs from 'node:fs';
import path from 'node:path';

import { moduleFederationConfigFile } from './constants';
import { inspectModuleFederationConfigSource } from './inspect';

/**
 * The expose map an app's own Module Federation config declares, keyed by
 * expose name (`./PageContacts`) with the package-relative source it points at
 * (`./src/federation/page-contacts.tsx`).
 *
 * Returns undefined when the app ships no Module Federation config, or when the
 * config cannot be inspected statically, so callers keep their own expectation
 * rather than inventing a surface path. `ultramodern mf-types` reports those
 * configs separately, so staying quiet here never hides a broken config.
 */
export function readModuleFederationExposePaths(
  workspaceRoot: string,
  appDirectory: string,
): Record<string, string> | undefined {
  const configPath = path.join(
    workspaceRoot,
    appDirectory,
    moduleFederationConfigFile,
  );
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  try {
    return inspectModuleFederationConfigSource(
      fs.readFileSync(configPath, 'utf-8'),
      appDirectory,
      path.join(appDirectory, moduleFederationConfigFile),
    ).exposePaths;
  } catch {
    return undefined;
  }
}
