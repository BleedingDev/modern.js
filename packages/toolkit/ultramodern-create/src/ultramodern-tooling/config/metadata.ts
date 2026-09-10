import path from 'node:path';
import { readOptionalJsonObject } from './json';

export function packageScopeFromRoot(workspaceRoot: string): string {
  const rootPackage = readOptionalJsonObject(
    path.join(workspaceRoot, 'package.json'),
  );
  return typeof rootPackage.name === 'string' && rootPackage.name.length > 0
    ? rootPackage.name
    : path.basename(workspaceRoot);
}
