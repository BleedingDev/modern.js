import fs from 'node:fs';
import path from 'node:path';
import execa from '@modern-js/utils/execa';
import type { CommandContext } from '../context';

export function runPnpmLockfileRefresh(context: CommandContext) {
  const result = execa.sync(
    'pnpm',
    ['install', '--no-frozen-lockfile', '--ignore-scripts'],
    { cwd: context.workspaceRoot, stdio: 'inherit', reject: false },
  );
  if ('code' in result) throw result;
  return result.exitCode ?? 1;
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
    if (
      !fs.existsSync(executable) &&
      !(process.platform === 'win32' && fs.existsSync(`${executable}.cmd`))
    ) {
      throw new Error(`Staged target analyzer is unavailable: ${command}`);
    }
  }
  for (const args of [
    ['exec', 'modern-api-check'],
    ['exec', 'ultramodern-create', 'ultramodern', 'validate'],
  ]) {
    const result = execa.sync('pnpm', args, {
      cwd: context.workspaceRoot,
      stdio: 'inherit',
      reject: false,
    });
    if ('code' in result) throw result;
    if (result.exitCode !== 0) return result.exitCode ?? 2;
  }
  return 0;
}
