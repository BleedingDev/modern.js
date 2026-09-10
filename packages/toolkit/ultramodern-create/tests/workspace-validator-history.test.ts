import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { preserveConsumerWorkspaceArtifacts } from '../src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership';
import { formatGeneratedSourceCandidates } from '../src/ultramodern-workspace/fs-io';

// Controlled excerpts of framework template blob 02062513698534c6b0d3de185ea75c21b9ecbb4e,
// shipped at 57e02edeaf733de0d592237cd2374f5f58c27822. No consumer fingerprints or runtime git.
const historicalView = `const readGeneratedContractView = config => {
  return synthesizeGeneratedContractFromCompact(config);
};`;
const historicalCall =
  'const generatedContract = readGeneratedContractView(ultramodernConfig);';
const currentView = `const readGeneratedContractView = (config, overlay) => {
  const ports = overlay.ports ?? {};
  return synthesizeGeneratedContractFromCompact({
    ...config,
    topology: {
      ...config.topology,
      apps: config.topology.apps.map(app => ({
        ...app,
        port: typeof ports[app.id] === 'number' ? ports[app.id] : app.port,
      })),
    },
  });
};`;
const currentCall =
  'const generatedContract = readGeneratedContractView(ultramodernConfig, overlay);';
const envelope = `const workspaceValidationContract = { kind: 'modernjs.ultramodern-workspace-validation-contract', cohort: { version: 'old' } };`;
const acceptance = `// Preserve the rest of the validator's acceptance logic.
assert(generatedContract.apps.length > 0, 'Generated apps must be present');`;
const historical = `${envelope}\n${historicalView}\n${historicalCall}\n${acceptance}\n`;
const current = `${envelope.replace("'old'", "'new'")}\n${currentView}\n${currentCall}\n${acceptance}\n`;
const relativePath = 'scripts/validate-ultramodern-workspace.mts';
let root: string;
let file: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-validator-history-'));
  file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const inspect = (source: string) => {
  fs.writeFileSync(file, source);
  const io = createMigrationIo(root, false);
  const result = preserveConsumerWorkspaceArtifacts(io, [
    {
      relativePath,
      content: current,
      generatedDataBinding: 'workspaceValidationContract',
    },
  ]);
  expect(fs.readFileSync(file, 'utf8')).toBe(source);
  return result;
};

test.each([
  'raw',
  'formatted',
])('recognizes the authentic historical pair in %s source', format => {
  const source =
    format === 'raw'
      ? historical
      : formatGeneratedSourceCandidates([[relativePath, historical]])[0]!;
  const result = inspect(source);
  expect(result.preservedPaths.has(relativePath)).toBe(false);
  expect(result.io.write(file, current)).toBe(true);
  expect(fs.readFileSync(file, 'utf8')).toBe(current);
});

test.each([
  [
    'changed function',
    historical.replace(
      'return synthesizeGeneratedContractFromCompact(config);',
      'return customContract(config);',
    ),
  ],
  [
    'changed call',
    historical.replace(
      'readGeneratedContractView(ultramodernConfig);',
      'readGeneratedContractView(customConfig);',
    ),
  ],
  ['only old function', historical.replace(historicalCall, currentCall)],
  ['only old call', historical.replace(historicalView, currentView)],
  ['added acceptance', `${historical}customAcceptance();\n`],
  [
    'changed acceptance',
    historical.replace('apps.length > 0', 'apps.length >= 0'),
  ],
  [
    'comment inside function',
    historical.replace(
      'return synthesize',
      '// Authored validation policy\n  return synthesize',
    ),
  ],
  [
    'comment inside call',
    historical.replace(
      'readGeneratedContractView(ultramodernConfig);',
      'readGeneratedContractView(/* keep my policy */ ultramodernConfig);',
    ),
  ],
  ['comment outside pair', `// Authored validation policy\n${historical}`],
])('preserves %s before any attempted writes', (_name, source) => {
  const result = inspect(source);
  expect(result.preservedPaths.has(relativePath)).toBe(true);
  expect(result.io.write(file, current)).toBe(false);
  expect(result.io.remove(file)).toBe(false);
  expect(fs.readFileSync(file, 'utf8')).toBe(source);
});
