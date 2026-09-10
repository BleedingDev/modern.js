import path from 'node:path';
import { readWorkspaceReleaseCohort } from '../../ultramodern-release-cohort';
import { createUltramodernConfig } from '../../ultramodern-workspace/contracts';
import { createShellHost } from '../../ultramodern-workspace/descriptors';
import { createPackagedWorkspaceValidationScript } from '../../ultramodern-workspace/workspace-scripts';
import {
  readJsonObject,
  readUltramodernWorkspaceInputs,
  workspaceAppsFromToolingConfig,
} from '../config';
import { type CommandContext, runRenderedModule } from './context';

export function runValidate(context: CommandContext) {
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
  const compactApps = workspaceAppsFromToolingConfig(config);
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
    for (const key of ['distributedSsrProofRoutes', 'jsonSmokeChecks']) {
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
  );

  return runRenderedModule(source, context);
}
