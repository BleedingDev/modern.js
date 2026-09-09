import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { CommandContext } from '../context';

export function runPnpmLockfileRefresh(context: CommandContext) {
  const result = spawnSync(
    'pnpm',
    ['install', '--no-frozen-lockfile', '--ignore-scripts'],
    { cwd: context.workspaceRoot, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function runStagedTargetChecks(
  context: CommandContext,
  strategy: 'install' | 'workspace',
) {
  // Workspace mode intentionally links the local checkout rather than an
  // authenticated published target. Published acceptance must use its own bins.
  if (strategy === 'workspace') return 0;
  for (const command of ['modern-api-check', 'ultramodern-create']) {
    const executable = path.join(
      context.workspaceRoot,
      'node_modules/.bin',
      command,
    );
    if (!fs.existsSync(executable)) {
      throw new Error(`Staged target analyzer is unavailable: ${command}`);
    }
  }
  for (const args of [
    ['exec', 'modern-api-check'],
    ['exec', 'ultramodern-create', 'ultramodern', 'validate'],
  ]) {
    const result = spawnSync('pnpm', args, {
      cwd: context.workspaceRoot,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 2;
  }
  return 0;
}
