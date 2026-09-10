import assert from 'node:assert/strict';
import { rstest } from '@rstest/core';
import { printHelp } from '../src/ultramodern-tooling/commands/context';
import {
  createGeneratedToolingWrapperMap,
  GENERATED_TOOLING_COMMANDS,
  generatedToolingCommandList,
  generatedToolingCommands,
  selectGeneratedToolingCommands,
} from '../src/ultramodern-workspace/tooling-command-catalog';

// Consumer-owned package scripts and persisted wrapper maps use these identities.
const publishedIdentities =
  `validate|validate|validate-ultramodern-workspace|contract:check
typecheck|typecheck|ultramodern-typecheck|typecheck
mfTypes|mf-types|assert-mf-types|mf:types
publicSurface|public-surface|generate-public-surface-assets|
backendFederationGenerate|backend-federation-generate|generate-node-backend-federation|node:backend-federation:generate
backendFederationProof|backend-federation-proof|proof-node-backend-federation|node:proof
cloudflareProof|cloudflare-proof|proof-cloudflare-version|cloudflare:proof
cloudflareOutputVerify|cloudflare-output-verify|verify-cloudflare-output|cloudflare-output:verify
performanceReadiness|performance-readiness|ultramodern-performance-readiness|performance:readiness
migrateStrictEffect|migrate-strict-effect|migrate-strict-effect|migrate:strict-effect
routesGenerate|routes-generate|generate-tanstack-routes|
zeropsMaterialize|zerops-materialize|materialize-zerops-runtime|zerops:materialize
cloudflareSsrProof|cloudflare-ssr-proof|proof-workerd-ssr|cloudflare:ssr-proof`
    .split('\n')
    .map(line => line.split('|'));

test('shared artifact metadata preserves the published wrapper identities', () => {
  assert.deepEqual(
    generatedToolingCommands.map(command => [
      command.id,
      command.command,
      command.wrapperName,
      command.rootScript ?? '',
    ]),
    publishedIdentities,
  );
  assert.deepEqual(
    createGeneratedToolingWrapperMap(),
    Object.fromEntries(
      publishedIdentities.map(([id, , basename]) => [
        id,
        `scripts/${basename}.${id === 'zeropsMaterialize' ? 'mjs' : 'mts'}`,
      ]),
    ),
  );
  assert.deepEqual(
    generatedToolingCommandList(),
    publishedIdentities.map(([, command]) => command),
  );
  for (const command of generatedToolingCommands) {
    assert.equal(GENERATED_TOOLING_COMMANDS[command.id], command);
    assert.equal(
      command.legacyPath,
      command.id === 'zeropsMaterialize'
        ? undefined
        : `scripts/${command.wrapperName}.mjs`,
    );
  }
});

test.each([
  { options: {}, backend: true },
  { options: { shellOnly: true }, backend: false },
  { options: { shellOnly: false }, backend: true },
  { options: { hasBackendSurface: false }, backend: false },
  { options: { shellOnly: false, hasBackendSurface: false }, backend: false },
  { options: { shellOnly: true, hasBackendSurface: true }, backend: true },
])('wrapper selection preserves backend precedence: $options', ({
  options,
  backend,
}) => {
  const selected = selectGeneratedToolingCommands(options);
  assert.deepEqual(
    selected.map(command => command.id),
    publishedIdentities
      .map(([id]) => id)
      .filter(
        id =>
          !('shellOnly' in options && options.shellOnly) ||
          !['zeropsMaterialize', 'cloudflareSsrProof'].includes(id),
      )
      .filter(
        id =>
          backend ||
          !['backendFederationGenerate', 'backendFederationProof'].includes(id),
      ),
  );
});

test('help exposes all wrapper and ad hoc commands without adding wrappers', () => {
  const output = rstest.spyOn(process.stdout, 'write').mockReturnValue(true);
  try {
    printHelp();
    const text = output.mock.calls.map(([chunk]) => String(chunk)).join('');
    assert.deepEqual(text.split('Commands:\n')[1].trimEnd().split('\n'), [
      ...publishedIdentities.map(([, command]) => `  ${command}`),
      '  sync-delivery-unit',
      '  skills install',
      '  skills check',
    ]);
    assert.equal(generatedToolingCommands.length, 13);
  } finally {
    output.mockRestore();
  }
});
