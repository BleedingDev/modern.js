import fs from 'node:fs';
import path from 'node:path';
import { parseExpression } from '@babel/parser';
import { yaml } from '@modern-js/utils';
import type { ResolvedUltramodernPackageSource } from '../../../ultramodern-package-source';
import {
  assertReleaseCohortPackageSource,
  parseUltramodernReleaseCohort,
  RELEASE_COHORT_PROJECTION_PATH,
  readWorkspaceReleaseCohort,
  releaseCohortSelectors,
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

/** Replace only authenticated cohort scalar values, retaining YAML layout and comments. */
export function replaceReleaseAgeSelectors(
  source: string,
  current: UltramodernReleaseCohort,
  target: UltramodernReleaseCohort,
): string {
  const { document } = parsePnpmWorkspaceYaml(source);
  if (JSON.stringify(current.aliases) !== JSON.stringify(target.aliases))
    throw new Error(
      'Release-age selector aliases differ from the authenticated source cohort.',
    );
  const from = releaseCohortSelectors(current);
  const to = releaseCohortSelectors(target);
  const selectors = document.minimumReleaseAgeExclude;
  if (
    !Array.isArray(selectors) ||
    new Set(selectors).size !== selectors.length ||
    from.some(value => selectors.filter(item => item === value).length !== 1)
  )
    throw new Error(
      'Release-age selectors do not match the authenticated source cohort.',
    );
  const replacements = new Map(from.map((value, index) => [value, to[index]]));
  // The bundled js-yaml parser exposes source offsets; its legacy declaration
  // file still describes only the load/dump API.
  type Event = {
    type: number;
    valueStart: number;
    valueEnd: number;
    anchorStart: number;
    tagStart: number;
    style: number;
  };
  const parser = yaml as unknown as {
    parseEvents(source: string): Event[];
    getScalarValue(source: string, event: Event): string;
    EVENT_DOCUMENT: number;
    EVENT_MAPPING: number;
    EVENT_SEQUENCE: number;
    EVENT_SCALAR: number;
    EVENT_POP: number;
    SCALAR_STYLE_SINGLE_QUOTED: number;
    SCALAR_STYLE_DOUBLE_QUOTED: number;
  };
  type Node = { event: Event; children: Node[] };
  const roots: Node[] = [];
  const stack: Node[] = [];
  for (const event of parser.parseEvents(source)) {
    if (event.type === parser.EVENT_POP) {
      stack.pop();
      continue;
    }
    const node = { event, children: [] };
    (stack.at(-1)?.children ?? roots).push(node);
    if (
      [
        parser.EVENT_DOCUMENT,
        parser.EVENT_MAPPING,
        parser.EVENT_SEQUENCE,
      ].includes(event.type)
    )
      stack.push(node);
  }
  const mapping = roots[0]?.children[0];
  if (mapping?.event.type !== parser.EVENT_MAPPING)
    throw new Error('Release-age policy requires a YAML mapping.');
  const keyIndex = mapping.children.findIndex(
    (node, index) =>
      index % 2 === 0 &&
      node.event.type === parser.EVENT_SCALAR &&
      parser.getScalarValue(source, node.event) === 'minimumReleaseAgeExclude',
  );
  const sequence = mapping.children[keyIndex + 1];
  if (
    keyIndex < 0 ||
    sequence?.event.type !== parser.EVENT_SEQUENCE ||
    sequence.event.anchorStart !== -1 ||
    sequence.event.tagStart !== -1
  )
    throw new Error(
      'Release-age selectors require an unaliased YAML sequence.',
    );
  const edits: Array<{ start: number; end: number; value: string }> = [];
  for (const node of sequence.children) {
    if (node.event.type !== parser.EVENT_SCALAR)
      throw new Error('Release-age selectors require literal YAML scalars.');
    const value = parser.getScalarValue(source, node.event);
    const replacement = replacements.get(value);
    if (replacement === undefined || replacement === value) continue;
    if (
      node.event.anchorStart !== -1 ||
      node.event.tagStart !== -1 ||
      ![
        parser.SCALAR_STYLE_SINGLE_QUOTED,
        parser.SCALAR_STYLE_DOUBLE_QUOTED,
      ].includes(node.event.style)
    )
      throw new Error(
        'Release-age selectors require unaliased quoted scalar values.',
      );
    edits.push({
      start: node.event.valueStart,
      end: node.event.valueEnd,
      value: replacement,
    });
  }
  for (const edit of edits.sort((left, right) => right.start - left.start))
    source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  const expected = {
    ...document,
    minimumReleaseAgeExclude: selectors.map(
      value => replacements.get(value) ?? value,
    ),
  };
  if (
    JSON.stringify(parsePnpmWorkspaceYaml(source).document) !==
    JSON.stringify(expected)
  )
    throw new Error('Release-age selector edits changed unrelated YAML data.');
  return source;
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
    source ===
      formatGeneratedSourceCandidates(
        [[relativePath, expected]],
        workspaceRoot,
      )[0]
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
  const policyWrites: UpdateWrite[] = [];
  const policyPreview = createMigrationIo(io.workspaceRoot, true);
  updateGeneratedPnpmWorkspacePolicy(
    {
      ...policyPreview,
      write(file, content) {
        policyWrites.push({
          path: path.relative(io.workspaceRoot, file),
          content,
        });
        return true;
      },
    },
    packageSource,
    { releaseCohort: target },
  );
  const policyPath = 'pnpm-workspace.yaml';
  const policySource = fs.readFileSync(
    path.join(io.workspaceRoot, policyPath),
    'utf8',
  );
  const policyContent = replaceReleaseAgeSelectors(
    policySource,
    source,
    target,
  );
  const targetPolicy =
    policyWrites.find(write => write.path === policyPath)?.content ??
    policySource;
  if (
    policyPreview.plan.length ||
    policyWrites.some(write => write.path !== policyPath) ||
    JSON.stringify(parsePnpmWorkspaceYaml(targetPolicy).document) !==
      JSON.stringify(parsePnpmWorkspaceYaml(policyContent).document)
  )
    return historical(
      'The target release policy requires a pnpm-workspace.yaml migration.',
    );
  const manifests = listWorkspacePackageFiles(io.workspaceRoot, {
    appDirectories: workspace.apps.map(app => app.directory),
    workspacePatterns: workspace.config.bridge?.workspacePackages.map(
      entry => entry.pattern,
    ),
  });
  const writes: UpdateWrite[] =
    policyContent === policySource
      ? []
      : [
          {
            path: policyPath,
            content: policyContent,
            pointers: ['/minimumReleaseAgeExclude'],
          },
        ];
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
