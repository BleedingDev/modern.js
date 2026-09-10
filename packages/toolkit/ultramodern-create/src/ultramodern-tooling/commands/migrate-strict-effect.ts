import fs from 'node:fs';
import path from 'node:path';
import {
  RELEASE_COHORT_PROJECTION_PATH,
  readCreateReleaseCohort,
  type UltramodernReleaseCohort,
} from '../../ultramodern-release-cohort';
import { runWorkspaceTransaction } from '../../ultramodern-workspace/add-vertical/transaction';
import { createSharedApi } from '../../ultramodern-workspace/api';
import { createAppEnvDts } from '../../ultramodern-workspace/app-files';
import {
  createDevelopmentOverlay,
  createTopology,
  createUltramodernConfig,
} from '../../ultramodern-workspace/contracts';
import { stampDeliveryUnitIdentity } from '../../ultramodern-workspace/delivery-unit-stamp';
import {
  appEmitsBrowserUi,
  appHasApi,
  resolveApiProtocol,
} from '../../ultramodern-workspace/descriptors';
import { ULTRAMODERN_WORKSPACE_POLICY } from '../../ultramodern-workspace/policy';
import { createAdditionalShellConfigEntry } from '../../ultramodern-workspace/shells';
import { generatedToolingCommands } from '../../ultramodern-workspace/tooling-command-catalog';
import type { WorkspaceApp } from '../../ultramodern-workspace/types';
import {
  createPackagedWorkspaceValidationScript,
  createWorkspaceScriptArtifacts,
  createWorkspaceValidationScript,
  writeGeneratedWorkspaceScripts,
} from '../../ultramodern-workspace/workspace-scripts';
import { createZeropsYaml } from '../../ultramodern-workspace/zerops';
import {
  additionalShellsFromToolingConfig,
  allWorkspaceAppsFromToolingConfig,
  normalizeCompactUltramodernConfig,
  normalizeWorkspaceInputs,
  preserveUnknownProjectionFields,
  reconcileGeneratedOverlayUrls,
  synthesizeCompactUltramodernConfig,
  workspaceAppsFromToolingConfig,
} from '../config';
import type { CommandContext } from './context';
import { migratePackageOwnedApiArtifacts } from './migrate-strict-effect/api-artifact-migration';
import {
  reconcileCompactPackageSourceMetadata,
  reconcilePackageSourceMetadata,
  updateReferenceTopology,
  updateUltramodernConfig,
} from './migrate-strict-effect/api-metadata';
import { migrateBffRuntimeImports } from './migrate-strict-effect/bff-runtime-import-migration';
import { ensureGeneratedDeclarationPatches } from './migrate-strict-effect/declaration-patches';
import { workspaceUsesDependency } from './migrate-strict-effect/dependency-usage';
import {
  ensureGeneratedOxfmtIgnorePatterns,
  ensureGeneratedOxlintComponentStyle,
  removeGeneratedFileIfExists,
  removeStaleBackendFederationArtifacts,
  updateGeneratedBackendFederationContractFiles,
  updateGeneratedBuildIdentityModules,
  updateGeneratedModernConfigs,
  updateGeneratedTypeScriptSurfaces,
  updateGeneratedZeropsArtifacts,
} from './migrate-strict-effect/generated-artifacts';
import { generatedUiSourceRequiresRewrite } from './migrate-strict-effect/generated-ui-source';
import { migrateStrictEffectHelp } from './migrate-strict-effect/help';
import {
  runPnpmLockfileRefresh,
  runStagedTargetChecks,
} from './migrate-strict-effect/install';
import {
  createMigrationIo,
  listWorkspacePackageFiles,
  type MigrationIo,
  readJsonFile,
  withStagedDryRunMigrationIo,
  writeJsonFile,
} from './migrate-strict-effect/io';
import {
  ensureBffEffectDependencies,
  updateGeneratedPackageScripts,
  updateGeneratedToolingDependencies,
  updateModernDependencies,
} from './migrate-strict-effect/package-cohort';
import { createMigrationPackageSource } from './migrate-strict-effect/package-source';
import {
  updateGeneratedPnpmWorkspacePolicy,
  validateGeneratedPnpmLockReleaseAgePolicy,
} from './migrate-strict-effect/pnpm-policy';
import {
  ensureGeneratedModuleFederationBridgeRouterOptOut,
  preflightModuleFederationBridgeRouter,
  removeRetiredReactRouterDependency,
} from './migrate-strict-effect/react-router-retirement';
import {
  assertSameContractDelta,
  hasCoherentCohortLock,
  prepareSameContractUpdate,
  readInstalledSourceCohort,
  type SameContractPlan,
  type UpdateOutcome,
} from './migrate-strict-effect/same-contract';
import { ensureSharedApiInfrastructure } from './migrate-strict-effect/shared-api-infrastructure';
import {
  updateGeneratedToolchainFiles,
  updateRootPackageToolchain,
} from './migrate-strict-effect/toolchain-pins';
import { preserveConsumerWorkspaceArtifacts } from './migrate-strict-effect/workspace-artifact-ownership';
import { hasFlag } from './options';

const retiredMetadataPaths = [
  '.modernjs/ultramodern-generated-contract.json',
  '.modernjs/ultramodern-package-source.json',
  '.modernjs/ultramodern-workspace-template-manifest.json',
] as const;

const rootPackageSourceOwnedKeys = [
  ...ULTRAMODERN_WORKSPACE_POLICY.metadata.packageSource.ownedKeys,
  'config',
] as const;

function requireRecord(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, any>;
}

function migrationWorkspaceInputs(
  workspaceRoot: string,
  config: Record<string, any>,
) {
  const overlayPath = path.join(
    workspaceRoot,
    'topology/local-overlays/development.json',
  );
  return normalizeWorkspaceInputs(workspaceRoot, {
    config,
    overlay: fs.existsSync(overlayPath)
      ? requireRecord(readJsonFile(overlayPath), 'Development topology overlay')
      : undefined,
  });
}

function synchronizeMigrationDeliveryUnitMetadata(
  io: MigrationIo,
  raw: Record<string, any>,
  packageSource: ReturnType<typeof createMigrationPackageSource>,
) {
  const workspace = migrationWorkspaceInputs(io.workspaceRoot, raw);
  const normalized = workspace.config;
  const apps = workspace.apps.filter(app =>
    normalized.topology.apps.some(entry => entry.id === app.id),
  );
  const appById = new Map(apps.map(app => [app.id, app] as const));
  const scope = normalized.workspace.packageScope;
  const primaryShell = apps.find(app => app.kind === 'shell');
  const canonicalCompact = requireRecord(
    createUltramodernConfig(
      scope,
      packageSource.modernPackageVersion,
      packageSource,
      apps,
      normalized.features.tailwind,
      normalized.bridge,
      additionalShellsFromToolingConfig(normalized),
      primaryShell,
    ),
    'Generated compact config',
  );
  const canonicalCompactApps = new Map<string, Record<string, unknown>>(
    (canonicalCompact.topology?.apps ?? []).map(
      (entry: Record<string, unknown>) => [String(entry.id), entry],
    ),
  );

  for (const entry of raw.topology?.apps ?? []) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const app = appById.get(String(entry.id));
    if (app) {
      stampDeliveryUnitIdentity(entry, scope, app);
      const canonicalEntry = canonicalCompactApps.get(app.id);
      if (canonicalEntry) {
        const deploy = canonicalEntry.deploy as Record<string, unknown>;
        entry.deploy = {
          ...deploy,
          ...entry.deploy,
          cloudflare: {
            ...(deploy.cloudflare as Record<string, unknown>),
            ...entry.deploy?.cloudflare,
          },
        };
        for (const key of ['moduleFederation', 'backendFederation', 'api']) {
          entry[key] = preserveUnknownProjectionFields(
            entry[key],
            canonicalEntry[key],
          );
        }
      }
    }
  }
  writeJsonFile(
    io,
    path.join(io.workspaceRoot, '.modernjs/ultramodern.json'),
    raw,
  );

  const topologyPath = path.join(
    io.workspaceRoot,
    'topology/reference-topology.json',
  );
  if (!fs.existsSync(topologyPath)) {
    return;
  }
  const topology = readJsonFile(topologyPath);
  const synchronizedWorkspace = migrationWorkspaceInputs(io.workspaceRoot, raw);
  const synchronizedApps = synchronizedWorkspace.apps.filter(app =>
    synchronizedWorkspace.config.topology.apps.some(
      entry => entry.id === app.id,
    ),
  );
  const synchronizedRemotes = synchronizedApps.filter(
    app => app.kind !== 'shell',
  );
  const synchronizedPrimaryShell = synchronizedApps.find(
    app => app.kind === 'shell',
  );
  const canonicalTopology = requireRecord(
    createTopology(scope, synchronizedRemotes, synchronizedPrimaryShell),
    'Generated reference topology',
  );
  for (const key of ['schemaVersion', 'id', 'description', 'preset']) {
    if (key === 'id' || key === 'description') {
      topology[key] ??= canonicalTopology[key];
    } else {
      topology[key] = canonicalTopology[key];
    }
  }
  const existingSharedPackages = Array.isArray(topology.sharedPackages)
    ? topology.sharedPackages
    : [];
  topology.sharedPackages = [
    ...existingSharedPackages,
    ...canonicalTopology.sharedPackages.filter(
      (candidate: Record<string, unknown>) =>
        !existingSharedPackages.some(
          (existing: Record<string, unknown>) => existing.id === candidate.id,
        ),
    ),
  ];
  topology.validation = {
    ...canonicalTopology.validation,
    ...topology.validation,
    commands: [
      ...new Set([
        ...(topology.validation?.commands ?? []),
        ...canonicalTopology.validation.commands,
      ]),
    ],
  };
  const canonicalTopologyApps = new Map<string, Record<string, unknown>>(
    [canonicalTopology.shell, ...(canonicalTopology.verticals ?? [])].map(
      (entry: Record<string, unknown>) => [String(entry.id), entry],
    ),
  );
  for (const entry of [topology.shell, ...(topology.verticals ?? [])]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const app = appById.get(String(entry.id));
    if (app) {
      stampDeliveryUnitIdentity(entry, scope, app);
      const canonicalEntry = canonicalTopologyApps.get(app.id);
      if (canonicalEntry) {
        for (const key of [
          'moduleFederation',
          'backendFederation',
          'api',
          'cloudflare',
          'ownership',
        ]) {
          if (Object.hasOwn(canonicalEntry, key)) {
            const canonicalValue = canonicalEntry[key];
            if (
              key === 'api' &&
              entry.api &&
              canonicalValue &&
              typeof canonicalValue === 'object'
            ) {
              const nextApi = preserveUnknownProjectionFields(
                entry.api,
                canonicalValue,
              );
              // Demo domain operations are not evidence that a customized API
              // implements the generated sample business endpoints.
              if (!Object.hasOwn(entry.api, 'domainOperations'))
                delete nextApi.domainOperations;
              entry.api = nextApi;
            } else if (
              key === 'cloudflare' &&
              entry.cloudflare &&
              canonicalValue &&
              typeof canonicalValue === 'object'
            ) {
              entry.cloudflare = { ...canonicalValue, ...entry.cloudflare };
            } else {
              entry[key] = preserveUnknownProjectionFields(
                entry[key],
                canonicalValue,
              );
            }
          } else {
            delete entry[key];
          }
        }
      }
    }
  }
  writeJsonFile(io, topologyPath, topology);
}

const compactPolicyKeys = [
  'schemaVersion',
  'profile',
  'workspace',
  'features',
  'deploy',
  'moduleFederation',
  'backendFederation',
  'agentSkills',
  'tooling',
] as const;

function synchronizeMigrationCompactPolicy(
  io: MigrationIo,
  raw: Record<string, any>,
  packageSource: ReturnType<typeof createMigrationPackageSource>,
) {
  const workspace = migrationWorkspaceInputs(io.workspaceRoot, raw);
  const migrated = workspace.config;
  const apps = workspace.apps.filter(app =>
    migrated.topology.apps.some(entry => entry.id === app.id),
  );
  const canonical = requireRecord(
    createUltramodernConfig(
      migrated.workspace.packageScope,
      packageSource.modernPackageVersion,
      packageSource,
      apps,
      migrated.features.tailwind,
      migrated.bridge,
      additionalShellsFromToolingConfig(migrated),
      apps.find(app => app.kind === 'shell'),
    ),
    'Generated compact policy',
  );

  for (const key of compactPolicyKeys) {
    if (key === 'workspace') {
      canonical.workspace.packageManager = {
        ...raw.workspace.packageManager,
        ...canonical.workspace.packageManager,
        version: raw.workspace.packageManager.version,
      };
    }
    raw[key] = preserveUnknownProjectionFields(raw[key], canonical[key]);
  }
  writeJsonFile(
    io,
    path.join(io.workspaceRoot, '.modernjs/ultramodern.json'),
    raw,
  );
}

function reconcileRootPackageSourceMetadata(
  packageJson: Record<string, any>,
  packageSource: ReturnType<typeof createMigrationPackageSource>,
) {
  const modernjs =
    packageJson.modernjs === undefined
      ? {}
      : requireRecord(packageJson.modernjs, 'package.json modernjs');
  packageJson.modernjs = modernjs;
  modernjs.packageSource = reconcilePackageSourceMetadata(
    modernjs.packageSource,
    {
      canonical: {
        strategy: packageSource.strategy,
        config: './.modernjs/ultramodern.json',
      },
      label: 'package.json modernjs.packageSource',
      ownedKeys: rootPackageSourceOwnedKeys,
    },
  );
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate identities.`);
  }
}

function deriveValidationContractInputs(
  workspaceRoot: string,
  migrated: ReturnType<typeof normalizeCompactUltramodernConfig>,
  migratedApps: WorkspaceApp[],
) {
  const rootPackage = readJsonFile(path.join(workspaceRoot, 'package.json'));
  const scope = requireString(rootPackage.name, 'Root package name');
  if (migrated.workspace.packageScope !== scope) {
    throw new Error(
      `Compact package scope ${migrated.workspace.packageScope} does not match root package ${scope}.`,
    );
  }

  const topologyPath = path.join(
    workspaceRoot,
    'topology/reference-topology.json',
  );
  if (!fs.existsSync(topologyPath)) {
    throw new Error(
      'Cannot render the migration validation contract without topology/reference-topology.json.',
    );
  }
  const topology = readJsonFile(topologyPath);
  const shell = requireRecord(topology.shell, 'Reference topology shell');
  if (!Array.isArray(topology.verticals)) {
    throw new Error('Reference topology verticals must be an array.');
  }
  const verticals: Record<string, any>[] = topology.verticals.map(
    (value: unknown, index: number) =>
      requireRecord(value, `Reference topology verticals[${index}]`),
  );
  const expectedApps = [
    {
      id: requireString(shell.id, 'Reference topology shell.id'),
      kind: 'shell',
      packageName: requireString(
        shell.package,
        'Reference topology shell.package',
      ),
      path: undefined,
      hasApi: false,
    },
    ...verticals.map((vertical, index) => ({
      id: requireString(
        vertical.id,
        `Reference topology verticals[${index}].id`,
      ),
      kind: 'vertical',
      packageName: requireString(
        vertical.package,
        `Reference topology verticals[${index}].package`,
      ),
      path: requireString(
        vertical.path,
        `Reference topology verticals[${index}].path`,
      ),
      hasApi: vertical.api !== undefined,
    })),
  ];
  assertUnique(
    expectedApps.map(app => app.id),
    'Reference topology app cohort',
  );
  assertUnique(
    expectedApps.map(app => app.packageName),
    'Reference topology package cohort',
  );

  const migratedById = new Map(migratedApps.map(app => [app.id, app] as const));
  assertUnique(
    migratedApps.map(app => app.id),
    'Compact topology app cohort',
  );
  const expectedIds = expectedApps.map(app => app.id).sort();
  const migratedIds = migratedApps.map(app => app.id).sort();
  if (JSON.stringify(expectedIds) !== JSON.stringify(migratedIds)) {
    throw new Error(
      `Compact topology app cohort ${migratedIds.join(', ')} does not match reference topology ${expectedIds.join(', ')}.`,
    );
  }

  const appPackageFiles = migratedApps.map(
    app => `${app.directory}/package.json`,
  );
  const manifests = appPackageFiles.map(relativePath => ({
    relativePath,
    packageJson: readJsonFile(path.join(workspaceRoot, relativePath)),
  }));
  const manifestsByName = new Map<string, (typeof manifests)[number]>();
  for (const manifest of manifests) {
    const name = requireString(
      manifest.packageJson.name,
      `${manifest.relativePath} name`,
    );
    if (manifestsByName.has(name)) {
      throw new Error(`Duplicate workspace app package name ${name}.`);
    }
    manifestsByName.set(name, manifest);
  }

  const tailwindStates: boolean[] = [];
  for (const expected of expectedApps) {
    const app = migratedById.get(expected.id);
    if (!app || app.kind !== expected.kind) {
      throw new Error(
        `Compact topology app ${expected.id} does not match reference kind ${expected.kind}.`,
      );
    }
    if (Boolean(app.api) !== expected.hasApi) {
      throw new Error(
        `Compact topology app ${expected.id} API presence does not match reference topology.`,
      );
    }

    const manifest = manifestsByName.get(expected.packageName);
    if (!manifest) {
      throw new Error(
        `Reference topology package ${expected.packageName} has no workspace manifest.`,
      );
    }
    const expectedManifestPath = `${app.directory}/package.json`;
    if (manifest.relativePath !== expectedManifestPath) {
      throw new Error(
        `${expected.packageName} is at ${manifest.relativePath}, expected ${expectedManifestPath}.`,
      );
    }
    if (expected.path && expected.path !== app.directory) {
      throw new Error(
        `Compact topology app ${expected.id} path ${app.directory} does not match reference path ${expected.path}.`,
      );
    }
    if (appEmitsBrowserUi(app))
      tailwindStates.push(
        Object.hasOwn(
          requireRecord(
            manifest.packageJson.devDependencies ?? {},
            `${manifest.relativePath} devDependencies`,
          ),
          '@rsbuild/plugin-tailwindcss',
        ),
      );
  }

  if (new Set(tailwindStates).size > 1) {
    throw new Error(
      'Generated app package manifests disagree on the Tailwind feature state.',
    );
  }
  const enableTailwind = tailwindStates[0] ?? migrated.features.tailwind;
  if (migrated.features.tailwind !== enableTailwind) {
    throw new Error(
      `Compact Tailwind state ${migrated.features.tailwind} does not match package manifests ${enableTailwind}.`,
    );
  }

  return {
    scope,
    enableTailwind,
    remotes: migratedApps.filter(app => app.kind !== 'shell'),
    primaryShell: migratedApps.find(app => app.kind === 'shell'),
    additionalShells: additionalShellsFromToolingConfig(migrated),
  };
}

/**
 * G28 shell records were initially emitted without the owner and complete
 * Module Federation projections. Reconcile those additive records before the
 * rest of migration derives artifacts, while retaining unknown consumer-owned
 * fields on each record. This also keeps an existing Delivery Unit marker
 * stable when it is already stamped.
 */
function reconcileAdditionalShellConfig(
  raw: Record<string, any>,
  migrated: ReturnType<typeof normalizeCompactUltramodernConfig>,
  io: ReturnType<typeof createMigrationIo>,
) {
  const additionalShells = additionalShellsFromToolingConfig(migrated);
  if (additionalShells.length === 0) {
    return migrated;
  }

  const existingShells = new Map(
    (Array.isArray(raw.shells) ? raw.shells : [])
      .filter(
        (entry: unknown): entry is Record<string, any> =>
          entry !== null &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          'id' in entry &&
          typeof entry.id === 'string',
      )
      .map((entry: Record<string, any>) => [entry.id, entry] as const),
  );
  const remotes = migrationWorkspaceInputs(io.workspaceRoot, raw).verticals;
  raw.shells = additionalShells.map(shell => ({
    ...preserveUnknownProjectionFields(
      existingShells.get(shell.id),
      createAdditionalShellConfigEntry(
        migrated.workspace.packageScope,
        shell,
        remotes,
      ),
    ),
  }));
  writeJsonFile(
    io,
    path.join(io.workspaceRoot, '.modernjs/ultramodern.json'),
    raw,
  );

  return normalizeCompactUltramodernConfig(io.workspaceRoot, raw);
}

function synchronizeMigrationDevelopmentOverlay(
  io: MigrationIo,
  migrated: ReturnType<typeof normalizeCompactUltramodernConfig>,
  migratedApps: WorkspaceApp[],
) {
  const overlayPath = path.join(
    io.workspaceRoot,
    'topology/local-overlays/development.json',
  );
  const existing = fs.existsSync(overlayPath)
    ? requireRecord(readJsonFile(overlayPath), 'Development topology overlay')
    : {};
  const effective = normalizeWorkspaceInputs(io.workspaceRoot, {
    config: migrated,
    overlay: existing,
  });
  const previous = requireRecord(
    createDevelopmentOverlay(
      migrated.workspace.packageScope,
      migratedApps.filter(app => app.kind !== 'shell'),
    ),
    'Previous development topology overlay',
  );
  const canonical = requireRecord(
    createDevelopmentOverlay(
      migrated.workspace.packageScope,
      effective.verticals,
    ),
    'Generated development topology overlay',
  );
  canonical.ports = {
    ...Object.fromEntries(
      effective.apps
        .filter(app =>
          migrated.topology.apps.some(entry => entry.id === app.id),
        )
        .map(app => [app.id, app.port]),
    ),
    ...existing.ports,
  };
  Object.assign(
    canonical,
    reconcileGeneratedOverlayUrls(existing, previous, canonical),
  );
  canonical.serverExecution = preserveUnknownProjectionFields(
    existing.serverExecution,
    canonical.serverExecution,
  );
  const frameworkOwnedKeys = new Set(Object.keys(canonical));
  const reconciled = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !frameworkOwnedKeys.has(key)),
  );
  Object.assign(reconciled, canonical);
  writeJsonFile(io, overlayPath, reconciled);
  return reconciled;
}

function migrateStrictEffect(
  args: string[],
  context: CommandContext,
  io: MigrationIo,
  dryRun: boolean,
  skipInstall: boolean,
  installedSource: UltramodernReleaseCohort | undefined,
  classify: (plan: SameContractPlan) => void,
) {
  const sourcePolicyPath = path.join(io.workspaceRoot, 'pnpm-workspace.yaml');
  const sourcePolicy =
    installedSource && fs.existsSync(sourcePolicyPath)
      ? {
          cohort: installedSource,
          policy: fs.readFileSync(sourcePolicyPath, 'utf8'),
        }
      : undefined;
  const compactPath = path.join(io.workspaceRoot, '.modernjs/ultramodern.json');
  let raw: Record<string, any>;
  if (fs.existsSync(compactPath)) {
    raw = readJsonFile(compactPath);
  } else {
    const synthesized = synthesizeCompactUltramodernConfig(io.workspaceRoot);
    if (!synthesized) {
      throw new Error(
        'Missing .modernjs/ultramodern.json and no legacy UltraModern metadata ' +
          '(.modernjs/ultramodern-generated-contract.json) was found to synthesize it from.',
      );
    }
    raw = synthesized.compact;
    io.log(
      `Synthesized .modernjs/ultramodern.json from legacy metadata: ${synthesized.sources.join(', ')}.`,
    );
    if (synthesized.missing.length > 0) {
      io.log(
        `Legacy metadata not found (using defaults): ${synthesized.missing.join(', ')}.`,
      );
    }
  }

  const currentWorkspace = normalizeWorkspaceInputs(io.workspaceRoot, {
    config: raw,
  });
  const current = currentWorkspace.config;
  preflightModuleFederationBridgeRouter(
    io.workspaceRoot,
    currentWorkspace.apps,
  );
  const packageSource = createMigrationPackageSource(args, current);
  let updatePlan: SameContractPlan | undefined;
  const result = (status: number): UpdateOutcome => ({
    status,
    version: packageSource.modernPackageVersion,
    classification: updatePlan?.classification ?? 'historical-migration',
    outcome: status !== 0 ? 'failed' : dryRun ? 'dry-run' : 'applied',
    changed:
      updatePlan?.writes.map(write => ({
        path: write.path,
        pointers: write.pointers,
        reason: 'Authenticated cohort dependency or release-data leaf.',
      })) ?? [],
    preserved:
      updatePlan?.classification === 'same-contract'
        ? [
            {
              path: '**/*',
              reason:
                'Consumer source, configuration, scripts, patches and delivery identity are preserved outside the reported dependency/release-data leaves and lock.',
            },
          ]
        : [],
    conflicts: [],
    validation: skipInstall
      ? 'partial'
      : packageSource.strategy === 'workspace'
        ? 'local-workspace'
        : 'staged-target',
  });
  const releaseCohort =
    packageSource.strategy === 'install'
      ? readCreateReleaseCohort()
      : undefined;

  updatePlan = prepareSameContractUpdate(
    io,
    raw,
    packageSource,
    releaseCohort,
    installedSource,
  );
  classify(updatePlan);
  io.log(`${updatePlan.classification}: ${updatePlan.reason}`);
  if (updatePlan.classification === 'same-contract') {
    if (updatePlan.coherentLock)
      return {
        ...result(0),
        outcome: dryRun ? 'dry-run' : 'noop',
        validation: 'coherent-existing-lock' as const,
      };
    for (const write of updatePlan.writes)
      io.write(path.join(io.workspaceRoot, write.path), write.content);
    if (skipInstall) return result(0);
    const status = runPnpmLockfileRefresh(context, sourcePolicy);
    if (status !== 0) return result(status);
    if (
      !hasCoherentCohortLock(
        io.workspaceRoot,
        updatePlan.manifests,
        releaseCohort!,
      )
    )
      throw new Error(
        'Resolved lock does not match the authenticated target dependency cohort.',
      );
    return validateGeneratedPnpmLockReleaseAgePolicy(
      io.workspaceRoot,
      packageSource,
      { releaseCohort },
    ).then(() =>
      result(runStagedTargetChecks(context, packageSource.strategy)),
    );
  }

  const allCurrentApps = currentWorkspace.apps;
  const artifactOwnership = preserveConsumerWorkspaceArtifacts(io, [
    {
      relativePath: 'scripts/validate-ultramodern-workspace.mts',
      content: createWorkspaceValidationScript(
        current.workspace.packageScope,
        current.features.tailwind,
      ),
    },
    ...allCurrentApps.map(app => ({
      relativePath: `${app.directory}/src/modern-app-env.d.ts`,
      content: createAppEnvDts(
        app,
        allCurrentApps.filter(remote => remote.kind !== 'shell'),
        current.workspace.packageScope,
      ),
    })),
    ...createWorkspaceScriptArtifacts({
      shellOnly: false,
      hasBackendSurface: true,
      validationScript: createPackagedWorkspaceValidationScript(
        current.workspace.packageScope,
        current.features.tailwind,
        currentWorkspace.verticals,
        undefined,
        currentWorkspace.additionalShells,
        currentWorkspace.primaryShell,
      ),
    }).map(artifact =>
      artifact.relativePath.includes('validate-ultramodern-workspace')
        ? { ...artifact, generatedDataBinding: 'workspaceValidationContract' }
        : artifact,
    ),
    {
      relativePath: 'zerops.yaml',
      content: `${createZeropsYaml(current.workspace.packageScope, currentWorkspace.apps)}\n`,
    },
    {
      relativePath: 'zerops.yaml',
      content: `${createZeropsYaml(current.workspace.packageScope, migrationWorkspaceInputs(io.workspaceRoot, raw).apps)}\n`,
    },
  ]);
  for (const relativePath of artifactOwnership.preservedPaths) {
    if (
      relativePath.includes('validate-ultramodern-workspace') &&
      fs.existsSync(path.join(io.workspaceRoot, relativePath)) &&
      fs
        .readFileSync(path.join(io.workspaceRoot, relativePath), 'utf8')
        .includes('check-ultramodern-api-boundaries')
    ) {
      throw new Error(
        `API migration conflict: ${relativePath} is customized and still requires the retired API checker; migrate its acceptance command to modern-api-check before retrying.`,
      );
    }
  }
  io = artifactOwnership.io;

  // Establish both metadata shapes in memory before the first write. Invalid
  // structural input must not leave a partially cleaned workspace behind.
  reconcileCompactPackageSourceMetadata(raw.packageSource, packageSource);
  reconcileRootPackageSourceMetadata(
    readJsonFile(path.join(io.workspaceRoot, 'package.json')),
    packageSource,
  );

  // Parse and reconcile into a dry-run IO before any migration writes. A
  // structurally ambiguous policy must fail atomically instead of leaving a
  // partially migrated workspace behind.
  updateGeneratedPnpmWorkspacePolicy(
    createMigrationIo(io.workspaceRoot, true),
    packageSource,
    { releaseCohort },
  );

  updateUltramodernConfig(io, raw, packageSource);
  if (releaseCohort) {
    io.write(
      path.join(io.workspaceRoot, RELEASE_COHORT_PROJECTION_PATH),
      `${JSON.stringify(releaseCohort, null, 2)}\n`,
    );
  }
  updateReferenceTopology(io);
  synchronizeMigrationDeliveryUnitMetadata(io, raw, packageSource);
  synchronizeMigrationCompactPolicy(io, raw, packageSource);
  let migrated = normalizeCompactUltramodernConfig(io.workspaceRoot, raw);
  migrated = reconcileAdditionalShellConfig(raw, migrated, io);
  const allMigratedApps = allWorkspaceAppsFromToolingConfig(migrated);
  const developmentOverlay = synchronizeMigrationDevelopmentOverlay(
    io,
    migrated,
    allCurrentApps,
  );
  const migratedWorkspace = normalizeWorkspaceInputs(io.workspaceRoot, {
    config: raw,
    overlay: developmentOverlay,
  });
  const validationContractInputs = deriveValidationContractInputs(
    io.workspaceRoot,
    migratedWorkspace.config,
    migratedWorkspace.apps.filter(app =>
      migrated.topology.apps.some(entry => entry.id === app.id),
    ),
  );
  // Two independent gates (never conflate them): a BACKEND surface exists
  // only when some unit ships an API; DELIVERY UNITS exist whenever any
  // vertical exists at all — ui-only and horizontal-remote units still deploy
  // through Zerops even though they have no backend-federation surface.
  const verticalApps = migrated.topology.apps.filter(
    app => app.kind !== 'shell',
  );
  const hasBackendSurface = verticalApps.some(app => app.api);
  const shellOnly = verticalApps.length === 0;

  const migratedApiFiles = migratePackageOwnedApiArtifacts(
    io,
    migrated.workspace.packageScope,
    packageSource,
    {
      appDirectories: migratedWorkspace.apps.map(app => app.directory),
      workspacePatterns: migratedWorkspace.config.bridge?.workspacePackages.map(
        entry => entry.pattern,
      ),
    },
  );

  if (hasBackendSurface) {
    ensureSharedApiInfrastructure(
      io,
      migrated.workspace.packageScope,
      packageSource,
    );
  }

  if (shellOnly) {
    io.log(
      'Shell-only workspace: skipping backend-federation and Zerops runtime stages.',
    );
    // Shell-only workspaces have no backend/Zerops surfaces, so strip any
    // backend-federation wrappers and Zerops runtime artifacts a prior scaffold
    // may have emitted. This keeps the end state coherent with the gated
    // validator contract and prevents dangling script references.
    for (const relativePath of [
      ...generatedToolingCommands
        .filter(command => command.requiresBackendSurface)
        .flatMap(command =>
          command.legacyPath
            ? [command.wrapperPath, command.legacyPath]
            : [command.wrapperPath],
        ),
      'scripts/materialize-zerops-runtime.mjs',
      'zerops.yaml',
    ]) {
      removeGeneratedFileIfExists(io, relativePath);
    }
  } else {
    if (hasBackendSurface) {
      removeStaleBackendFederationArtifacts(io, migrated);
      updateGeneratedBackendFederationContractFiles(io, migrated);
    } else {
      // No backend surface: strip backend-federation wrappers, keep deploys.
      for (const relativePath of [
        ...generatedToolingCommands
          .filter(command => command.requiresBackendSurface)
          .flatMap(command =>
            command.legacyPath
              ? [command.wrapperPath, command.legacyPath]
              : [command.wrapperPath],
          ),
      ]) {
        removeGeneratedFileIfExists(io, relativePath);
      }
    }
    updateGeneratedZeropsArtifacts(io, migrated);
  }

  writeGeneratedWorkspaceScripts(
    io.workspaceRoot,
    validationContractInputs.scope,
    validationContractInputs.enableTailwind,
    validationContractInputs.remotes,
    releaseCohort,
    validationContractInputs.additionalShells,
    validationContractInputs.primaryShell,
    {
      io,
      compactConfig: raw,
      ownership: fs.existsSync(
        path.join(io.workspaceRoot, 'topology/ownership.json'),
      )
        ? requireRecord(
            readJsonFile(
              path.join(io.workspaceRoot, 'topology/ownership.json'),
            ),
            'Ownership topology',
          )
        : undefined,
      developmentOverlay,
    },
  );
  artifactOwnership.refreshReleaseCohort(releaseCohort);

  for (const relativePath of retiredMetadataPaths) {
    io.remove(path.join(io.workspaceRoot, relativePath));
  }

  updateGeneratedBuildIdentityModules(io, migrated);
  updateGeneratedTypeScriptSurfaces(io, migrated);

  migrateBffRuntimeImports(io, packageSource, releaseCohort, {
    appDirectories: migratedWorkspace.apps.map(app => app.directory),
    workspacePatterns: migratedWorkspace.config.bridge?.workspacePackages.map(
      entry => entry.pattern,
    ),
  });

  // Compare final imports after both API migrations before claiming generated ownership.
  for (const app of migratedWorkspace.apps) {
    if (!appHasApi(app) || resolveApiProtocol(app) !== 'rest') continue;
    const relativePath = path.posix.join(app.directory, 'shared/api.ts');
    if (!migratedApiFiles.has(relativePath)) continue;
    const filePath = path.join(io.workspaceRoot, relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    const generated = createSharedApi(app, {
      scope: migrated.workspace.packageScope,
    });
    if (!generatedUiSourceRequiresRewrite(source, generated)) {
      io.writeGenerated(filePath, source);
    }
  }

  const canRetireLegacyOxfmtCliExclusion =
    ensureGeneratedOxfmtIgnorePatterns(io);
  const rootScripts = readJsonFile(
    path.join(io.workspaceRoot, 'package.json'),
  ).scripts;
  const hasLegacyOxfmtCliExclusion =
    rootScripts &&
    typeof rootScripts === 'object' &&
    !Array.isArray(rootScripts) &&
    Object.values(rootScripts).some(
      script =>
        typeof script === 'string' &&
        /\boxfmt(?: --check)? \. '!repos\/\*\*'(?:\s*&&|$)/u.test(script),
    );
  if (hasLegacyOxfmtCliExclusion && !canRetireLegacyOxfmtCliExclusion) {
    throw new Error(
      "Cannot replace the legacy Oxfmt '!repos/**' CLI exclusion until " +
        "oxfmt.config.ts has a static ignorePatterns array containing 'repos/**'.",
    );
  }

  for (const relativePackageFile of listWorkspacePackageFiles(
    io.workspaceRoot,
    {
      appDirectories: migratedWorkspace.apps.map(app => app.directory),
      workspacePatterns: migratedWorkspace.config.bridge?.workspacePackages.map(
        entry => entry.pattern,
      ),
    },
  )) {
    const packageFile = path.join(io.workspaceRoot, relativePackageFile);
    const packageJson = readJsonFile(packageFile);

    if (relativePackageFile === 'package.json') {
      reconcileRootPackageSourceMetadata(packageJson, packageSource);
      updateRootPackageToolchain(packageJson);
    }

    updateModernDependencies(packageJson, packageSource, releaseCohort, {
      app: migratedWorkspace.apps.find(
        app => `${app.directory}/package.json` === relativePackageFile,
      ),
    });
    const ownsGeneratedScripts =
      relativePackageFile === 'package.json' ||
      allMigratedApps.some(
        app => `${app.directory}/package.json` === relativePackageFile,
      );
    updateGeneratedToolingDependencies(packageJson, {
      ownsGeneratedScripts,
    });
    ensureBffEffectDependencies(packageJson);
    const retiredReactRouter = removeRetiredReactRouterDependency(
      packageJson,
      path.join(io.workspaceRoot, path.dirname(relativePackageFile)),
    );
    if (retiredReactRouter === 'preserved') {
      io.log(
        `${relativePackageFile} keeps its react-router dependency: authored ` +
          'source imports React Router directly, so its generated Module ' +
          'Federation config keeps bridge.enableBridgeRouter: true.',
      );
    } else if (retiredReactRouter === 'removed') {
      io.log(
        `${relativePackageFile} dropped its obsolete react-router dependency: ` +
          'no authored source imports React Router.',
      );
    }
    updateGeneratedPackageScripts(packageJson, {
      preservedArtifacts: artifactOwnership.preservedPaths,
      relativePackageFile,
      bridgeEnabled: Boolean(migrated.bridge),
      apps: allMigratedApps,
      shellOnly,
      canRetireLegacyOxfmtCliExclusion,
      onPreserveScript: scriptName =>
        io.log(
          `${relativePackageFile} script ${JSON.stringify(scriptName)} was preserved: ` +
            'an existing command is mixed consumer/framework ownership.',
        ),
    });

    writeJsonFile(io, packageFile, packageJson);
  }

  // Generated Module Federation configs derive bridge.enableBridgeRouter from
  // each app's declared React Router dependency, so they must be regenerated
  // only after the retirement pass above has settled those manifests —
  // otherwise a legacy pin that this run removes would still read as an opt-in.
  updateGeneratedModernConfigs(io, migrated);
  ensureGeneratedModuleFederationBridgeRouterOptOut(io, allMigratedApps);

  updateGeneratedPnpmWorkspacePolicy(io, packageSource, { releaseCohort });
  updateGeneratedToolchainFiles(io);
  const drizzleOrmPatch =
    ULTRAMODERN_WORKSPACE_POLICY.pnpm.patchedDependencies.conditional.find(
      patch => patch.packageName === 'drizzle-orm',
    );
  ensureGeneratedDeclarationPatches(io, {
    includeDrizzleOrmPatch:
      drizzleOrmPatch !== undefined &&
      workspaceUsesDependency(
        io.workspaceRoot,
        drizzleOrmPatch.packageName,
        drizzleOrmPatch.version,
      ),
  });
  ensureGeneratedOxlintComponentStyle(io);

  if (!skipInstall) {
    // The outer publisher owns this private stage. Preserve the consumer lock
    // as resolver input; neither failed install nor target checks touch live files.
    const status = runPnpmLockfileRefresh(context, sourcePolicy);
    if (status !== 0) return result(status);
    return validateGeneratedPnpmLockReleaseAgePolicy(
      io.workspaceRoot,
      packageSource,
      { releaseCohort },
    ).then(() => {
      const checkStatus = runStagedTargetChecks(
        context,
        packageSource.strategy,
      );
      return result(checkStatus);
    });
  }

  return result(0);
}

export function runMigrateStrictEffect(
  args: string[],
  context: CommandContext,
) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(migrateStrictEffectHelp);
    return 0;
  }

  const dryRun = hasFlag(args, '--dry-run');
  const skipInstall = dryRun || hasFlag(args, '--skip-install');
  const installedSource = readInstalledSourceCohort(context.workspaceRoot);
  let updatePlan: SameContractPlan | undefined;
  let netChanges: string[] = [];
  let dryRunPlan: readonly string[] = [];
  const runMigration = (io: MigrationIo, migrationContext: CommandContext) =>
    io.transaction(
      () =>
        migrateStrictEffect(
          args,
          migrationContext,
          io,
          dryRun,
          skipInstall,
          installedSource,
          plan => {
            updatePlan = plan;
          },
        ),
      { commitWhen: migrationResult => migrationResult.status === 0 },
    );
  const withContext = (io: MigrationIo) => {
    if (dryRun) dryRunPlan = io.plan;
    const invocationRelativePath = path.relative(
      context.workspaceRoot,
      context.invocationCwd,
    );
    const invocationIsOutsideWorkspace =
      invocationRelativePath === '..' ||
      invocationRelativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(invocationRelativePath);
    return runMigration(io, {
      workspaceRoot: io.workspaceRoot,
      invocationCwd: invocationIsOutsideWorkspace
        ? context.invocationCwd
        : path.join(io.workspaceRoot, invocationRelativePath),
    });
  };
  const migration = dryRun
    ? withStagedDryRunMigrationIo(context.workspaceRoot, withContext)
    : runWorkspaceTransaction(
        context.workspaceRoot,
        stage =>
          withContext(createMigrationIo(stage, false, context.workspaceRoot)),
        {
          commitWhen: migrationResult => migrationResult.status === 0,
          inspectChanges: changes => {
            if (updatePlan?.classification === 'same-contract')
              assertSameContractDelta(updatePlan, changes);
            netChanges = changes.map(change => change.relativePath);
          },
        },
      );

  const report = (migrationResult: Awaited<typeof migration>) => {
    if (dryRun && migrationResult.status === 0) {
      for (const line of dryRunPlan) process.stdout.write(`${line}\n`);
      if (
        migrationResult.classification === 'historical-migration' &&
        migrationResult.version
      ) {
        process.stdout.write(
          `[dry-run] migrate-strict-effect would migrate UltraModern strict Effect metadata to ${migrationResult.version}.\n`,
        );
      }
    }
    if (!dryRun) {
      migrationResult.changed = netChanges.map(relativePath => ({
        path: relativePath,
        pointers: updatePlan?.writes.find(write => write.path === relativePath)
          ?.pointers,
        reason:
          relativePath === 'pnpm-lock.yaml'
            ? 'Package-manager-produced dependency lock.'
            : migrationResult.classification === 'same-contract'
              ? 'Authenticated dependency/release-data leaf.'
              : 'Recognized historical migration.',
      }));
      if (migrationResult.status === 0 && netChanges.length === 0)
        migrationResult.outcome = 'noop';
    }
    process.stdout.write(`${JSON.stringify(migrationResult)}\n`);
    if (migrationResult.status === 0 && !dryRun) {
      process.stdout.write(
        `UltraModern ${migrationResult.classification} ${migrationResult.outcome} for ${migrationResult.version}. ` +
          (migrationResult.validation === 'partial'
            ? 'Partial validation (--skip-install); lock and target checks were skipped.\n'
            : migrationResult.validation === 'coherent-existing-lock'
              ? 'Existing authenticated dependency lock is coherent; no install was needed.\n'
              : migrationResult.validation === 'local-workspace'
                ? 'Local workspace dependencies resolved in staging; published-target checks do not apply.\n'
                : 'Target dependencies and checks passed in staging. Run pnpm install to materialize the promoted lock locally.\n'),
      );
    }
    return migrationResult.status;
  };

  if (migration instanceof Promise) {
    return migration.then(report);
  }
  return report(migration);
}
