import fs from 'node:fs';
import path from 'node:path';
import { parseExpression } from '@babel/parser';
import type { ResolvedUltramodernPackageSource } from '../../../ultramodern-package-source';
import {
  assertReleaseCohortPackageSource,
  parseUltramodernReleaseCohort,
  RELEASE_COHORT_PROJECTION_PATH,
  readWorkspaceReleaseCohort,
  type UltramodernReleaseCohort,
} from '../../../ultramodern-release-cohort';
import { appEmitsBrowserUi } from '../../../ultramodern-workspace/descriptors';
import { formatGeneratedSourceCandidates } from '../../../ultramodern-workspace/fs-io';
import { createUltramodernBuildModule } from '../../../ultramodern-workspace/module-federation';
import { createWorkspaceValidationScript } from '../../../ultramodern-workspace/workspace-scripts';
import { normalizeWorkspaceInputs } from '../../config';
import {
  createMigrationIo,
  listWorkspacePackageFiles,
  type MigrationIo,
  readJsonFile,
} from './io';
import { updateSameContractDependencies } from './package-cohort';
import { updateGeneratedPnpmWorkspacePolicy } from './pnpm-policy';
import {
  discoverReachablePnpmLockReleaseAgeClosure,
  parsePnpmWorkspaceYaml,
} from './pnpm-yaml';
import { recognizesReleaseCohortRead } from './workspace-artifact-ownership';

export type UpdateClassification =
  | 'same-contract'
  | 'historical-migration'
  | 'conflict';
export type UpdateOutcome = {
  status: number;
  version: string;
  classification: UpdateClassification;
  outcome: 'applied' | 'noop' | 'dry-run' | 'failed';
  changed: Array<{ path: string; pointers?: string[]; reason: string }>;
  preserved: Array<{ path: string; reason: string }>;
  conflicts: Array<{ path?: string; symbol?: string; reason: string }>;
  validation:
    | 'partial'
    | 'staged-target'
    | 'coherent-existing-lock'
    | 'local-workspace';
};

type JsonLeaf = { keys: string[]; value: string };
type UpdateWrite = { path: string; content: string; pointers?: string[] };
export type SameContractPlan = {
  classification: 'same-contract' | 'historical-migration';
  reason: string;
  writes: UpdateWrite[];
  manifests: string[];
  coherentLock: boolean;
};

/** Change exact string tokens, retaining all surrounding consumer JSON bytes. */
export function replaceJsonStringLeaves(
  source: string,
  leaves: JsonLeaf[],
): string {
  JSON.parse(source);
  const nodes = new Map<string, { start: number; end: number }>();
  const visit = (node: any, keys: string[]) => {
    if (node.type === 'ObjectExpression') {
      const seen = new Set<string>();
      for (const property of node.properties) {
        if (
          property.type !== 'ObjectProperty' ||
          property.key.type !== 'StringLiteral'
        )
          throw new Error('Expected a JSON object property.');
        const key = property.key.value;
        if (seen.has(key))
          throw new Error(
            `Ambiguous duplicate JSON property: ${[...keys, key].join('.')}`,
          );
        seen.add(key);
        visit(property.value, [...keys, key]);
      }
    } else if (node.type === 'ArrayExpression') {
      node.elements.forEach((child: any, index: number) =>
        visit(child, [...keys, String(index)]),
      );
    } else if (node.type === 'StringLiteral') {
      nodes.set(JSON.stringify(keys), { start: node.start, end: node.end });
    }
  };
  visit(parseExpression(source), []);
  const replacements = leaves
    .map(leaf => {
      const span = nodes.get(JSON.stringify(leaf.keys));
      if (!span)
        throw new Error(`Missing JSON string leaf: ${leaf.keys.join('.')}`);
      return { ...span, value: JSON.stringify(leaf.value) };
    })
    .sort((left, right) => right.start - left.start);
  for (const replacement of replacements)
    source =
      source.slice(0, replacement.start) +
      replacement.value +
      source.slice(replacement.end);
  return source;
}

/** The installed source package supplies independent cohort evidence before staging excludes node_modules. */
export function readInstalledSourceCohort(
  workspaceRoot: string,
): UltramodernReleaseCohort | undefined {
  const packageRoot = path.join(
    workspaceRoot,
    'node_modules/@modern-js/ultramodern-create',
  );
  const cohortPath = path.join(
    packageRoot,
    'template-workspace',
    RELEASE_COHORT_PROJECTION_PATH,
  );
  if (!fs.existsSync(cohortPath)) return undefined;
  const cohort = parseUltramodernReleaseCohort(readJsonFile(cohortPath));
  const manifest = readJsonFile(path.join(packageRoot, 'package.json'));
  const identity = cohort.packages.find(
    item => item.sourceName === '@modern-js/ultramodern-create',
  );
  if (
    !identity ||
    manifest.name !== identity.targetName ||
    manifest.version !== identity.version
  ) {
    throw new Error(
      'Installed source creator does not match its release cohort projection.',
    );
  }
  return cohort;
}

function matchesNativeSource(
  workspaceRoot: string,
  relativePath: string,
  expected: string,
) {
  const file = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(file)) return false;
  const source = fs.readFileSync(file, 'utf8');
  return (
    source === expected ||
    source === formatGeneratedSourceCandidates([[relativePath, expected]])[0]
  );
}

export function hasCoherentCohortLock(
  workspaceRoot: string,
  manifests: string[],
  cohort: UltramodernReleaseCohort,
): boolean {
  const file = path.join(workspaceRoot, 'pnpm-lock.yaml');
  if (!fs.existsSync(file)) return false;
  try {
    const { document: lock } = parsePnpmWorkspaceYaml(
      fs.readFileSync(file, 'utf8'),
      file,
    );
    const names = new Set(
      cohort.packages.flatMap(item => [item.sourceName, item.targetName]),
    );
    for (const relativePath of manifests) {
      const manifest = readJsonFile(path.join(workspaceRoot, relativePath));
      const importer = lock.importers?.[path.posix.dirname(relativePath)];
      for (const section of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
      ]) {
        for (const [name, specifier] of Object.entries(
          manifest[section] ?? {},
        )) {
          if (!names.has(name)) continue;
          if (importer?.[section]?.[name]?.specifier !== specifier)
            return false;
        }
      }
    }
    const closure = discoverReachablePnpmLockReleaseAgeClosure(lock);
    if (closure.unresolved.length) return false;
    return (
      closure.candidates.every(
        item =>
          !names.has(item.packageName) ||
          item.version === cohort.release.version,
      ) && closure.tarballs.every(item => !names.has(item.packageName))
    );
  } catch {
    return false;
  }
}

export function prepareSameContractUpdate(
  io: MigrationIo,
  raw: Record<string, any>,
  packageSource: ResolvedUltramodernPackageSource,
  target: UltramodernReleaseCohort | undefined,
  installedSource: UltramodernReleaseCohort | undefined,
): SameContractPlan {
  const historical = (reason: string): SameContractPlan => ({
    classification: 'historical-migration',
    reason,
    writes: [],
    manifests: [],
    coherentLock: false,
  });
  if (!target || !installedSource || packageSource.strategy !== 'install')
    return historical(
      'Authenticated installed source and target cohorts are required for a same-contract update.',
    );
  assertReleaseCohortPackageSource(target, packageSource);
  if (
    !fs.existsSync(path.join(io.workspaceRoot, RELEASE_COHORT_PROJECTION_PATH))
  )
    return historical(
      'Source release projection needs a recognized historical migration.',
    );
  const source = readWorkspaceReleaseCohort(io.workspaceRoot);
  if (JSON.stringify(source) !== JSON.stringify(installedSource))
    throw new Error(
      'Workspace release projection does not match the authenticated installed source cohort.',
    );
  const workspace = normalizeWorkspaceInputs(io.workspaceRoot, { config: raw });
  assertReleaseCohortPackageSource(source, workspace.config.packageSource!);
  if (
    ['registry', 'aliasScope', 'aliasPackageNamePrefix'].some(
      key =>
        (workspace.config.packageSource as any)?.[key] !==
        (packageSource as any)[key],
    )
  ) {
    return historical(
      'Package-source profile rebinding requires an explicit migration.',
    );
  }
  if (
    source.release.version === target.release.version &&
    JSON.stringify(source) !== JSON.stringify(target)
  )
    throw new Error(
      'The same release version names different authenticated cohorts.',
    );
  if (JSON.stringify(source.aliases) !== JSON.stringify(target.aliases))
    return historical(
      'Alias profile or package membership changes require an explicit historical migration.',
    );
  const rootManifest = readJsonFile(
    path.join(io.workspaceRoot, 'package.json'),
  );
  const rootSource = rootManifest.modernjs?.packageSource;
  if (
    !rootSource ||
    rootSource.strategy !== 'install' ||
    rootSource.config !== './.modernjs/ultramodern.json' ||
    [
      'generatedWorkspacePackages',
      'metadata',
      'modernPackages',
      'modernPackageVersion',
      'registry',
      'aliasScope',
      'aliasPackageNamePrefix',
    ].some(key => Object.hasOwn(rootSource, key)) ||
    ['generatedWorkspacePackages', 'metadata', 'modernPackages'].some(key =>
      Object.hasOwn(raw.packageSource, key),
    )
  ) {
    return historical(
      'Retired or duplicated package-source metadata requires migration.',
    );
  }
  for (const retired of [
    'ultramodern-generated-contract.json',
    'ultramodern-package-source.json',
    'ultramodern-workspace-template-manifest.json',
  ]) {
    if (fs.existsSync(path.join(io.workspaceRoot, '.modernjs', retired)))
      return historical(
        `Retired metadata .modernjs/${retired} requires migration.`,
      );
  }
  const validator = [
    'scripts/validate-ultramodern-workspace.mts',
    'scripts/validate-ultramodern-workspace.mjs',
  ].find(relative => fs.existsSync(path.join(io.workspaceRoot, relative)));
  if (
    !validator ||
    (!matchesNativeSource(
      io.workspaceRoot,
      validator,
      createWorkspaceValidationScript(
        workspace.config.workspace.packageScope,
        workspace.config.features.tailwind,
      ),
    ) &&
      !recognizesReleaseCohortRead(
        fs.readFileSync(path.join(io.workspaceRoot, validator), 'utf8'),
      ))
  ) {
    return historical(
      'The validator requires recognized native wrapper/data migration.',
    );
  }
  for (const app of workspace.apps) {
    const includeUiMarker =
      appEmitsBrowserUi(app) &&
      (app.kind !== 'shell' ||
        fs.existsSync(
          path.join(
            io.workspaceRoot,
            app.directory,
            'src/ultramodern-build.ts',
          ),
        ));
    if (
      !matchesNativeSource(
        io.workspaceRoot,
        `${app.directory}/shared/ultramodern-build.ts`,
        createUltramodernBuildModule(
          workspace.config.workspace.packageScope,
          app,
          includeUiMarker,
        ),
      ) ||
      !fs.existsSync(
        path.join(
          io.workspaceRoot,
          app.directory,
          'shared/ultramodern-build.json',
        ),
      )
    ) {
      return historical(
        `Delivery identity for ${app.directory} requires recognized native wrapper/data migration.`,
      );
    }
  }
  const policyPreview = createMigrationIo(io.workspaceRoot, true);
  updateGeneratedPnpmWorkspacePolicy(policyPreview, packageSource, {
    releaseCohort: target,
  });
  if (policyPreview.plan.length)
    return historical(
      'The target release policy requires a pnpm-workspace.yaml migration.',
    );
  const manifests = listWorkspacePackageFiles(io.workspaceRoot, {
    appDirectories: workspace.apps.map(app => app.directory),
    workspacePatterns: workspace.config.bridge?.workspacePackages.map(
      entry => entry.pattern,
    ),
  });
  const writes: UpdateWrite[] = [];
  for (const relativePath of manifests) {
    const text = fs.readFileSync(
      path.join(io.workspaceRoot, relativePath),
      'utf8',
    );
    const manifest = JSON.parse(text);
    if (
      ['dependencies', 'devDependencies'].some(
        section => manifest[section]?.['@modern-js/create'] !== undefined,
      )
    )
      return historical(
        'Retired creator dependency requires a package-name migration.',
      );
    const changed = updateSameContractDependencies(manifest, source, target);
    const content = replaceJsonStringLeaves(
      text,
      changed.map(change => ({
        keys: [change.section, change.name],
        value: change.value,
      })),
    );
    if (content !== text)
      writes.push({
        path: relativePath,
        content,
        pointers: changed.map(
          change =>
            `/${change.section}/${change.name.replaceAll('~', '~0').replaceAll('/', '~1')}`,
        ),
      });
  }
  const compactPath = '.modernjs/ultramodern.json';
  const compactSource = fs.readFileSync(
    path.join(io.workspaceRoot, compactPath),
    'utf8',
  );
  const compactContent = replaceJsonStringLeaves(compactSource, [
    {
      keys: ['packageSource', 'modernPackageVersion'],
      value: target.release.version,
    },
  ]);
  if (compactContent !== compactSource)
    writes.push({
      path: compactPath,
      content: compactContent,
      pointers: ['/packageSource/modernPackageVersion'],
    });
  if (JSON.stringify(source) !== JSON.stringify(target))
    writes.push({
      path: RELEASE_COHORT_PROJECTION_PATH,
      content: `${JSON.stringify(target, null, 2)}\n`,
    });
  return {
    classification: 'same-contract',
    reason:
      'Authenticated native validator and delivery identity contracts accept the same consumer data.',
    writes,
    manifests,
    coherentLock:
      writes.length === 0 &&
      hasCoherentCohortLock(io.workspaceRoot, manifests, target),
  };
}

/** Validate the publisher's net changes after install/check subprocesses finish. */
export function assertSameContractDelta(
  plan: SameContractPlan,
  changes: readonly {
    relativePath: string;
    before?: { content: Buffer; mode: number; symlink?: true };
    after?: { content: Buffer; mode: number; symlink?: true };
  }[],
) {
  const expected = new Map(
    plan.writes.map(write => [write.path, write.content]),
  );
  for (const change of changes) {
    if (
      change.relativePath === 'pnpm-lock.yaml' &&
      change.after &&
      !change.after.symlink &&
      (!change.before || change.before.mode === change.after.mode)
    )
      continue;
    const content = expected.get(change.relativePath);
    if (
      content === undefined ||
      !change.after ||
      change.after.symlink ||
      !change.before ||
      change.before.symlink ||
      change.before.mode !== change.after.mode ||
      change.after.content.toString('utf8') !== content
    ) {
      throw new Error(
        `Same-contract update attempted an unapproved change: ${change.relativePath}`,
      );
    }
    expected.delete(change.relativePath);
  }
  if (expected.size)
    throw new Error(
      `Same-contract prepared changes were not preserved: ${[...expected.keys()].join(', ')}`,
    );
}
