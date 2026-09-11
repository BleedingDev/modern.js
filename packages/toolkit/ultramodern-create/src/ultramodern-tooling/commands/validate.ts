import path from 'node:path';
import { readWorkspaceReleaseCohort } from '../../ultramodern-release-cohort';
import { createUltramodernConfig } from '../../ultramodern-workspace/contracts';
import { createShellHost } from '../../ultramodern-workspace/descriptors';
import {
  checkPatchParity,
  formatPatchParityReport,
} from '../../ultramodern-workspace/patch-parity';
import { createPackagedWorkspaceValidationScript } from '../../ultramodern-workspace/workspace-scripts';
import {
  readJsonObject,
  readUltramodernWorkspaceInputs,
  workspaceAppsFromToolingConfig,
} from '../config';
import {
  type CommandContext,
  createPackageRoot,
  runRenderedModule,
} from './context';

export function runValidate(context: CommandContext) {
  // A workspace that still carries a previous cohort's patch keeps applying it,
  // and the mismatch only shows up much later as an opaque `require.resolve`
  // failure inside `modern build`. Name the file here instead.
  const patchProblems = checkPatchParity({
    workspaceRoot: context.workspaceRoot,
    createPackageRoot,
  });
  if (patchProblems.length > 0) {
    process.stderr.write(`${formatPatchParityReport(patchProblems)}\n`);
    return 1;
  }

  const workspace = readUltramodernWorkspaceInputs(context.workspaceRoot, {
    overlay: readJsonObject(
      path.join(
        context.workspaceRoot,
        'topology/local-overlays/development.json',
      ),
    ),
  });
  const {
    config,
    verticals: remotes,
    primaryShell,
    additionalShells,
  } = workspace;
  const compactApps = workspaceAppsFromToolingConfig(
    config,
    context.workspaceRoot,
  );
  const compactPrimaryShell =
    compactApps.find(app => app.kind === 'shell') ?? createShellHost(remotes);
  // Overlay ports govern local endpoints; compact metadata retains its own
  // canonical ports and policy rather than adopting the observed projections.
  const compactConfig = createUltramodernConfig(
    config.workspace.packageScope,
    'workspace-validation-contract',
    { strategy: 'workspace', modernPackageVersion: 'workspace:*' },
    compactApps,
    config.features.tailwind,
    undefined,
    additionalShells,
    compactPrimaryShell,
    remotes,
  ) as Record<string, unknown>;
  const declaredCompact = readJsonObject(config.sourcePath);
  const compactTopology = compactConfig.topology as {
    apps: Array<{
      id: string;
      deploy: { cloudflare: Record<string, unknown> };
    }>;
  };
  for (const app of compactTopology.apps) {
    const declared = declaredCompact.topology?.apps?.find(
      (entry: { id: string }) => entry.id === app.id,
    )?.deploy?.cloudflare;
    // Business routes and assertions are consumer inputs, independently
    // exercised by the runtime proof. Framework deployment fields retain
    // their canonical expectations.
    for (const key of [
      'routes',
      'distributedSsrProofRoutes',
      'jsonSmokeChecks',
    ]) {
      if (declared && Object.hasOwn(declared, key)) {
        app.deploy.cloudflare[key] = declared[key];
      }
    }
  }
  const releaseCohort =
    config.packageSource?.strategy === 'install'
      ? readWorkspaceReleaseCohort(context.workspaceRoot)
      : undefined;
  const source = createPackagedWorkspaceValidationScript(
    config.workspace.packageScope,
    config.features.tailwind,
    remotes,
    releaseCohort,
    additionalShells,
    primaryShell,
    compactConfig,
    // Team attribution is authored configuration. The validator separately
    // checks each owner's package/path against the normalized app topology.
    readJsonObject(path.join(context.workspaceRoot, 'topology/ownership.json')),
    undefined,
    context.workspaceRoot,
  );

  return runRenderedModule(source, context);
}
