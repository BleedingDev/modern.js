import fs from 'node:fs';
import path from 'node:path';
import execa from '@modern-js/utils/execa';
import {
  releaseCohortSelectors,
  type UltramodernReleaseCohort,
} from '../../../ultramodern-release-cohort';
import type { CommandContext } from '../context';
import {
  parsePnpmWorkspaceYaml,
  stringifyPnpmWorkspaceYaml,
} from './pnpm-yaml';

/** Called only inside the publisher's private stage; never changes the promoted policy. */
export function runPnpmLockfileRefresh(
  context: CommandContext,
  source?: { cohort: UltramodernReleaseCohort; policy: string },
) {
  const policyPath = path.join(context.workspaceRoot, 'pnpm-workspace.yaml');
  let targetBytes: Buffer | undefined;
  let temporaryBytes: Buffer | undefined;
  if (source) {
    const original = parsePnpmWorkspaceYaml(source.policy).document;
    const approved = original.minimumReleaseAgeExclude;
    if (
      !Array.isArray(approved) ||
      approved.some(value => typeof value !== 'string')
    )
      throw new Error(
        'The authenticated source release-age policy must contain exact string selectors.',
      );
    targetBytes = fs.readFileSync(policyPath);
    const { document, lineEnding } = parsePnpmWorkspaceYaml(
      targetBytes.toString('utf8'),
    );
    const targetSelectors = document.minimumReleaseAgeExclude;
    if (
      !Array.isArray(targetSelectors) ||
      targetSelectors.some(value => typeof value !== 'string')
    )
      throw new Error(
        'The prepared target release-age policy must contain exact string selectors.',
      );
    const retained = releaseCohortSelectors(source.cohort).filter(
      selector =>
        approved.includes(selector) && !targetSelectors.includes(selector),
    );
    if (retained.length) {
      document.minimumReleaseAgeExclude = [
        ...new Set([...targetSelectors, ...retained]),
      ].sort();
      temporaryBytes = Buffer.from(
        stringifyPnpmWorkspaceYaml(document, lineEnding),
      );
    }
  }
  try {
    if (temporaryBytes) fs.writeFileSync(policyPath, temporaryBytes);
    const result = execa.sync(
      'pnpm',
      ['install', '--no-frozen-lockfile', '--ignore-scripts'],
      { cwd: context.workspaceRoot, stdio: 'inherit', reject: false },
    );
    if ('code' in result) throw result;
    if (temporaryBytes && !fs.readFileSync(policyPath).equals(temporaryBytes))
      throw new Error(
        'The staged package manager changed the temporary release-age policy.',
      );
    return result.exitCode ?? 1;
  } finally {
    if (temporaryBytes && targetBytes)
      fs.writeFileSync(policyPath, targetBytes);
  }
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
