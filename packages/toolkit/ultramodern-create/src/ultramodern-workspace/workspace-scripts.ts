import fs from 'node:fs';
import path from 'node:path';
import type { UltramodernReleaseCohort } from '../ultramodern-release-cohort';
import { appHasApi } from './descriptors';
import {
  readFileTemplate,
  renderFileTemplate,
  workspaceTemplateDir,
  writeFileReplacing,
} from './fs-io';
import { selectGeneratedToolingCommands } from './tooling-command-catalog';
import type { WorkspaceApp } from './types';
import { WORKSPACE_SCRIPT_SEGMENT_PATTERN } from './workspace-script-plan';
import { createWorkspaceValidationContract } from './workspace-validation-contract';

// Emitted wrapper source must satisfy the generated workspace's oxfmt config,
// which enforces `singleQuote: true`; JSON.stringify would emit double quotes.
const singleQuoted = (value: string) => `'${value.replace(/'/gu, "\\'")}'`;

const toolWrapperResultHandling = `
if (result.error) {
  const launchTarget = createBin
    ? process.execPath + ' with ULTRAMODERN_CREATE_BIN=' + createBin
    : 'ultramodern-create from PATH';
  console.error(
    'Failed to launch ' +
      launchTarget +
      ' for UltraModern command "' +
      ultramodernArgs.slice(1).join(' ') +
      '": ' +
      result.error.message,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
`;

function createToolWrapperScript(command: string, extraArgs: string[] = []) {
  const commandLiteral = singleQuoted(command);
  const extraArgsLiteral = `[${extraArgs.map(singleQuoted).join(', ')}]`;

  return `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const createBin = process.env.ULTRAMODERN_CREATE_BIN;
const forwardedArgs = process.argv.slice(2);
const workspaceRoot =
  process.env.ULTRAMODERN_WORKSPACE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ultramodernArgs = ['ultramodern', ${commandLiteral}, ...${extraArgsLiteral}, ...forwardedArgs];
const result = createBin
  ? spawnSync(process.execPath, [createBin, ...ultramodernArgs], {
      env: { ...process.env, ULTRAMODERN_WORKSPACE_ROOT: workspaceRoot },
      stdio: 'inherit',
    })
  : spawnSync('ultramodern-create', ultramodernArgs, {
      env: { ...process.env, ULTRAMODERN_WORKSPACE_ROOT: workspaceRoot },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
${toolWrapperResultHandling}`;
}

function createSkillsToolWrapperScript() {
  return `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const createBin = process.env.ULTRAMODERN_CREATE_BIN;
const forwardedArgs = process.argv.slice(2);
const workspaceRoot =
  process.env.ULTRAMODERN_WORKSPACE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = forwardedArgs.includes('--check');
const skillArgs = checkOnly
  ? ['skills', 'check', ...forwardedArgs.filter(arg => arg !== '--check')]
  : ['skills', 'install', ...forwardedArgs];
const ultramodernArgs = ['ultramodern', ...skillArgs];
const result = createBin
  ? spawnSync(process.execPath, [createBin, ...ultramodernArgs], {
      env: { ...process.env, ULTRAMODERN_WORKSPACE_ROOT: workspaceRoot },
      stdio: 'inherit',
    })
  : spawnSync('ultramodern-create', ultramodernArgs, {
      env: { ...process.env, ULTRAMODERN_WORKSPACE_ROOT: workspaceRoot },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
${toolWrapperResultHandling}`;
}

export function createPackagedWorkspaceValidationScript(
  scope: string,
  enableTailwind: boolean,
  remotes: WorkspaceApp[] = [],
  releaseCohort?: UltramodernReleaseCohort,
  additionalShells: WorkspaceApp[] = [],
  primaryShell?: WorkspaceApp,
  compactConfigOverride?: Record<string, unknown>,
  ownershipOverride?: Record<string, unknown>,
  developmentOverlayOverride?: Record<string, unknown>,
): string {
  const contract = createWorkspaceValidationContract(
    scope,
    enableTailwind,
    remotes,
    releaseCohort,
    additionalShells,
    primaryShell,
    compactConfigOverride,
    ownershipOverride,
    developmentOverlayOverride,
  );

  return renderFileTemplate(
    'workspace-scripts/validate-ultramodern-workspace.mjs',
    {
      workspaceValidationContractJson: JSON.stringify(contract, null, 2),
      workspaceScriptSegmentPattern: JSON.stringify(
        WORKSPACE_SCRIPT_SEGMENT_PATTERN.source,
      ),
    },
  );
}

// The stable consumer entrypoint delegates to the installed cohort's validator.
// Release and topology data are read by that command at invocation time.
export function createWorkspaceValidationScript(
  ..._options: Parameters<typeof createPackagedWorkspaceValidationScript>
): string {
  return createToolWrapperScript('validate');
}

function createWorkspaceI18nBoundaryValidationScript(): string {
  return readFileTemplate(
    'workspace-scripts/check-ultramodern-i18n-boundaries.mts',
  );
}

function createPerformanceReadinessConfigScript(): string {
  return readFileTemplate(
    'workspace-scripts/ultramodern-performance-readiness.config.mjs',
  );
}

export function createZeropsRuntimeMaterializationScript(): string {
  return createToolWrapperScript('zerops-materialize');
}

export function writeGeneratedWorkspaceScripts(
  targetDir: string,
  scope: string,
  enableTailwind: boolean,
  remotes: WorkspaceApp[] = [],
  releaseCohort?: UltramodernReleaseCohort,
  additionalShells: WorkspaceApp[] = [],
  primaryShell?: WorkspaceApp,
  options: {
    io?: { writeGenerated: (filePath: string, content: string) => unknown };
    compactConfig?: Record<string, unknown>;
    ownership?: Record<string, unknown>;
    developmentOverlay?: Record<string, unknown>;
  } = {},
) {
  for (const artifact of createWorkspaceScriptArtifacts({
    shellOnly: remotes.length === 0,
    hasBackendSurface: remotes.some(appHasApi),
    validationScript: createWorkspaceValidationScript(
      scope,
      enableTailwind,
      remotes,
      releaseCohort,
      additionalShells,
      primaryShell,
      options.compactConfig,
      options.ownership,
      options.developmentOverlay,
    ),
  })) {
    if (options.io) {
      options.io.writeGenerated(
        path.join(targetDir, artifact.relativePath),
        artifact.content,
      );
    } else {
      writeFileReplacing(targetDir, artifact.relativePath, artifact.content);
    }
  }
}

// The canonical `setup-agent-reference-repos` script is vendored under
// template-workspace/ and copied (then renamed to .mts) during fresh scaffolds.
// Additional apps materialize the same canonical source here.
function createAgentReferenceReposSetupScript(): string {
  return fs.readFileSync(
    path.join(workspaceTemplateDir, 'scripts/setup-agent-reference-repos.mjs'),
    'utf-8',
  );
}

interface WorkspaceScriptDefinition {
  relativePath: string;
  createContent: () => string;
  requiresRemotes?: boolean;
}

// These copied assets and the skills adapter are distinct from CLI wrappers.
const workspaceScriptDefinitions: readonly WorkspaceScriptDefinition[] = [
  {
    relativePath: 'scripts/check-ultramodern-i18n-boundaries.mts',
    createContent: createWorkspaceI18nBoundaryValidationScript,
  },
  {
    relativePath: 'scripts/ultramodern-performance-readiness.config.mjs',
    createContent: createPerformanceReadinessConfigScript,
  },
  {
    relativePath: 'scripts/bootstrap-agent-skills.mts',
    createContent: createSkillsToolWrapperScript,
  },
  {
    relativePath: 'scripts/setup-agent-reference-repos.mts',
    createContent: createAgentReferenceReposSetupScript,
  },
];

export interface WorkspaceScriptArtifact {
  relativePath: string;
  content: string;
  generatedDataBinding?: string;
}

export function createWorkspaceScriptArtifacts(options: {
  shellOnly: boolean;
  hasBackendSurface?: boolean;
  validationScript?: string;
}): WorkspaceScriptArtifact[] {
  return [
    ...workspaceScriptDefinitions
      .filter(definition => !options.shellOnly || !definition.requiresRemotes)
      .map(({ createContent, requiresRemotes, ...definition }) => ({
        ...definition,
        content: createContent(),
      })),
    ...selectGeneratedToolingCommands(options).map(command => ({
      relativePath: command.wrapperPath,
      content:
        command.id === 'validate' && options.validationScript !== undefined
          ? options.validationScript
          : createToolWrapperScript(command.command),
    })),
  ];
}
