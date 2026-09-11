import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { expectedReleaseCohort } from '../published-create-proof/package-cohort.mjs';
import { collectPackageJsonFiles } from './contract.mjs';

// Installs one authenticated release into a workspace already using the current
// contract. This changes dependency versions and their release identity only.
export function prepareTractorCohortInstallation(
  workspace,
  release,
  minimumReleaseAgeExclude,
) {
  const cohort = expectedReleaseCohort(release);
  const version = release.release.version;
  const projection = release.cohortProjection?.value;
  if (
    !projection ||
    !isDeepStrictEqual(projection.aliases, cohort.aliases) ||
    projection.release.version !== version
  ) {
    throw new Error(
      'Tractor cohort installation requires the authenticated release projection',
    );
  }
  const configPath = path.join(workspace, '.modernjs/ultramodern.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (
    config.packageSource?.strategy !== 'install' ||
    !config.generator?.version
  ) {
    throw new Error(
      'Tractor must already use the current install-backed workspace contract',
    );
  }
  const policyPath = path.join(workspace, 'pnpm-workspace.yaml');
  const policy = fs.readFileSync(policyPath, 'utf8');
  const exclusionsBlock =
    /^minimumReleaseAgeExclude:[^\r\n]*\r?\n(?:[ \t]+[^\r\n]*\r?\n)*/gm;
  const matches = [...policy.matchAll(exclusionsBlock)];
  if (
    matches.length !== 1 ||
    !Array.isArray(minimumReleaseAgeExclude) ||
    minimumReleaseAgeExclude.length === 0 ||
    minimumReleaseAgeExclude.some(
      value => typeof value !== 'string' || /[\r\n'"*?]/u.test(value),
    )
  ) {
    throw new Error(
      'Tractor requires the current release-age policy and exact reviewed exclusions',
    );
  }
  const nextPolicy = policy.replace(
    exclusionsBlock,
    `minimumReleaseAgeExclude:\n${minimumReleaseAgeExclude.map(value => `  - '${value}'\n`).join('')}`,
  );
  const writes = [];
  let dependencyCount = 0;
  for (const file of collectPackageJsonFiles(workspace)) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    let changed = false;
    for (const block of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const name of Object.keys(manifest[block] ?? {})) {
        if (!name.startsWith('@modern-js/')) continue;
        const target = cohort.aliases[name];
        if (!target)
          throw new Error(
            `Tractor dependency ${name} is absent from the release cohort`,
          );
        manifest[block][name] = `npm:${target}@${version}`;
        dependencyCount += 1;
        changed = true;
      }
    }
    if (changed) writes.push([file, manifest]);
  }
  if (dependencyCount === 0)
    throw new Error('Tractor has no framework dependencies to install');
  config.generator.version = version;
  config.packageSource.modernPackageVersion = version;
  writes.push(
    [configPath, config],
    [path.join(workspace, '.modernjs/release-cohort.json'), projection],
  );
  for (const [file, value] of writes)
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  fs.writeFileSync(policyPath, nextPolicy);
  return { dependencyCount };
}
