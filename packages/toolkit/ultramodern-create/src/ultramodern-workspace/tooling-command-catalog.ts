export type GeneratedToolingCommandId =
  | 'validate'
  | 'typecheck'
  | 'mfTypes'
  | 'publicSurface'
  | 'backendFederationGenerate'
  | 'backendFederationProof'
  | 'cloudflareProof'
  | 'cloudflareOutputVerify'
  | 'performanceReadiness'
  | 'migrateStrictEffect'
  | 'routesGenerate'
  | 'zeropsMaterialize'
  | 'cloudflareSsrProof';

export type GeneratedToolingCommandKey = GeneratedToolingCommandId;

interface GeneratedToolingCommand {
  id: GeneratedToolingCommandId;
  command: string;
  wrapperName: string;
  wrapperPath: `scripts/${string}.mts` | `scripts/${string}.mjs`;
  legacyPath?: `scripts/${string}.mjs`;
  requiresBackendSurface: boolean;
  requiresRemotes?: boolean;
  contractKey: string;
  rootScript?: string;
  templatePath?: `templates/workspace-scripts/${string}.mjs`;
  cwd?: 'invocation';
}

const defineToolingCommand = (
  command: Omit<
    GeneratedToolingCommand,
    'wrapperPath' | 'legacyPath' | 'requiresBackendSurface'
  > & {
    requiresBackendSurface?: boolean;
    wrapperPath?: GeneratedToolingCommand['wrapperPath'];
  },
): GeneratedToolingCommand => ({
  requiresBackendSurface: false,
  ...command,
  legacyPath: command.wrapperPath
    ? undefined
    : `scripts/${command.wrapperName}.mjs`,
  wrapperPath: command.wrapperPath ?? `scripts/${command.wrapperName}.mts`,
});

export const generatedToolingCommands = [
  defineToolingCommand({
    id: 'validate',
    command: 'validate',
    wrapperName: 'validate-ultramodern-workspace',
    contractKey: 'validate',
    rootScript: 'contract:check',
  }),
  defineToolingCommand({
    id: 'typecheck',
    command: 'typecheck',
    wrapperName: 'ultramodern-typecheck',
    contractKey: 'typecheck',
    rootScript: 'typecheck',
    templatePath: 'templates/workspace-scripts/ultramodern-typecheck.mjs',
    cwd: 'invocation',
  }),
  defineToolingCommand({
    id: 'mfTypes',
    command: 'mf-types',
    wrapperName: 'assert-mf-types',
    contractKey: 'mfTypes',
    rootScript: 'mf:types',
  }),
  defineToolingCommand({
    id: 'publicSurface',
    command: 'public-surface',
    wrapperName: 'generate-public-surface-assets',
    contractKey: 'publicSurface',
    templatePath:
      'templates/workspace-scripts/generate-public-surface-assets.mjs',
  }),
  defineToolingCommand({
    id: 'backendFederationGenerate',
    requiresBackendSurface: true,
    command: 'backend-federation-generate',
    wrapperName: 'generate-node-backend-federation',
    contractKey: 'backendFederationGenerate',
    rootScript: 'node:backend-federation:generate',
    templatePath:
      'templates/workspace-scripts/generate-node-backend-federation.mjs',
  }),
  defineToolingCommand({
    id: 'backendFederationProof',
    requiresBackendSurface: true,
    command: 'backend-federation-proof',
    wrapperName: 'proof-node-backend-federation',
    contractKey: 'backendFederationProof',
    rootScript: 'node:proof',
    templatePath:
      'templates/workspace-scripts/proof-node-backend-federation.mjs',
  }),
  defineToolingCommand({
    id: 'cloudflareProof',
    command: 'cloudflare-proof',
    wrapperName: 'proof-cloudflare-version',
    contractKey: 'cloudflareProof',
    rootScript: 'cloudflare:proof',
    templatePath: 'templates/workspace-scripts/proof-cloudflare-version.mjs',
  }),
  defineToolingCommand({
    id: 'cloudflareOutputVerify',
    command: 'cloudflare-output-verify',
    wrapperName: 'verify-cloudflare-output',
    contractKey: 'cloudflareOutputVerify',
    rootScript: 'cloudflare-output:verify',
  }),
  defineToolingCommand({
    id: 'performanceReadiness',
    command: 'performance-readiness',
    wrapperName: 'ultramodern-performance-readiness',
    contractKey: 'performanceReadiness',
    rootScript: 'performance:readiness',
    templatePath:
      'templates/workspace-scripts/ultramodern-performance-readiness.mjs',
  }),
  defineToolingCommand({
    id: 'migrateStrictEffect',
    command: 'migrate-strict-effect',
    wrapperName: 'migrate-strict-effect',
    contractKey: 'migrateStrictEffect',
    rootScript: 'migrate:strict-effect',
  }),
  defineToolingCommand({
    id: 'routesGenerate',
    command: 'routes-generate',
    wrapperName: 'generate-tanstack-routes',
    contractKey: 'routesGenerate',
  }),
  defineToolingCommand({
    id: 'zeropsMaterialize',
    command: 'zerops-materialize',
    wrapperName: 'materialize-zerops-runtime',
    wrapperPath: 'scripts/materialize-zerops-runtime.mjs',
    contractKey: 'zeropsMaterialize',
    rootScript: 'zerops:materialize',
    templatePath: 'templates/workspace-scripts/materialize-zerops-runtime.mjs',
    requiresRemotes: true,
  }),
  defineToolingCommand({
    id: 'cloudflareSsrProof',
    command: 'cloudflare-ssr-proof',
    wrapperName: 'proof-workerd-ssr',
    contractKey: 'cloudflareSsrProof',
    rootScript: 'cloudflare:ssr-proof',
    templatePath: 'templates/workspace-scripts/proof-workerd-ssr.mjs',
    requiresRemotes: true,
  }),
] as const satisfies readonly GeneratedToolingCommand[];

// An explicit backend-surface choice takes precedence over shell-only inference.
export function selectGeneratedToolingCommands(
  options: { shellOnly?: boolean; hasBackendSurface?: boolean } = {},
) {
  const backendSurface = options.hasBackendSurface ?? !options.shellOnly;
  return generatedToolingCommands.filter(
    command =>
      (!options.shellOnly || !command.requiresRemotes) &&
      (backendSurface || !command.requiresBackendSurface),
  );
}

const toolingCommandById = Object.fromEntries(
  generatedToolingCommands.map(command => [command.id, command]),
) as Record<GeneratedToolingCommandId, GeneratedToolingCommand>;

export const GENERATED_TOOLING_COMMANDS = toolingCommandById;

export const generatedToolingCommandList = () =>
  generatedToolingCommands.map(command => command.command);

const createToolingWrapperContract = () =>
  Object.fromEntries(
    generatedToolingCommands.map(command => [
      command.contractKey,
      command.wrapperPath,
    ]),
  ) as Record<
    GeneratedToolingCommandKey,
    GeneratedToolingCommand['wrapperPath']
  >;

export const createGeneratedToolingWrapperMap = createToolingWrapperContract;
