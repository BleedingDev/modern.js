// Native Tractor topology: named contract import, group handler chain, composed
// Layer and an explicitly typed exported runtime alias. No application execution.
export const contract =
  'export const fixtureApi = {}; export const aliasApi = fixtureApi;';
const imports = `
import { assembleEffectBffRuntime } from '@fixture/shared-contracts/server/effect-bff-runtime';
import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/plugin-bff/effect-edge';
import { fixtureApi } from '../shared/api.ts';
`;
const groups = `const group = HttpApiBuilder.group(fixtureApi, 'fixture', handlers =>
  handlers.handle('list', () => undefined).handle('get', () => undefined));
const handlers = Layer.mergeAll(group);`;
export const direct = `${imports}${groups}
const layer = HttpApiBuilder.layer(fixtureApi).pipe(Layer.provide(handlers));
const apiRuntime: unknown = defineEffectBff({ api: fixtureApi, layer });
export default apiRuntime;`;
export const shared = `${imports}${groups}
export default assembleEffectBffRuntime({ api: fixtureApi, handlers });`;
export const local = `${imports}import { handlers } from './handlers.ts';
export default assembleEffectBffRuntime({ api: fixtureApi, handlers });`;
export const localHandlers = `${imports.replace('fixtureApi }', 'aliasApi as fixtureApi }')}${groups.replace('const handlers', 'export const handlers')}`;
const cleanShared = shared.replace('defineEffectBff, ', '');
export const positives = {
  native: {
    source: direct.replace(
      "import { assembleEffectBffRuntime } from '@fixture/shared-contracts/server/effect-bff-runtime';",
      '',
    ),
  },
  shared: { source: cleanShared },
  factory: {
    source:
      cleanShared.replace(
        'export default assembleEffectBffRuntime',
        'const make = () => assembleEffectBffRuntime',
      ) + '\nexport default make();',
  },
  aliased: {
    source: cleanShared
      .replaceAll('assembleEffectBffRuntime', 'assemble')
      .replace(
        'import { assemble }',
        'import { assembleEffectBffRuntime as assemble }',
      ),
  },
  local: {
    source: local.replace(
      "import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/plugin-bff/effect-edge';",
      '',
    ),
    handlers: localHandlers,
  },
};
export const negatives = {
  comment: { source: `/* ${shared} */ export default undefined;` },
  string: {
    source: `const decoy = ${JSON.stringify(shared)}; export default undefined;`,
  },
  discarded: { source: direct.replace('export default apiRuntime;', '') },
  'spoofed-root': {
    source: direct.replace('defineEffectBff,', 'fake as defineEffectBff,'),
  },
  'spoofed-builder': {
    source: shared.replace('HttpApiBuilder,', 'fake as HttpApiBuilder,'),
  },
  'spoofed-layer': { source: shared.replace('Layer }', 'fake as Layer }') },
  'type-only': {
    source: shared.replace(
      'import { assembleEffectBffRuntime',
      'import type { assembleEffectBffRuntime',
    ),
  },
  'foreign-assembly': {
    source: shared.replace(
      '@fixture/shared-contracts/server/effect-bff-runtime',
      '@fixture/untrusted/server/effect-bff-runtime',
    ),
  },
  'client-assembly': {
    source: shared.replace('/server/effect-bff-runtime', '/effect-bff-runtime'),
  },
  'no-handlers': {
    source: shared.replace('Layer.mergeAll(group)', 'Layer.empty'),
  },
  'no-chain': {
    source: shared.replace(
      "handlers.handle('list', () => undefined).handle('get', () => undefined)",
      'handlers',
    ),
  },
  'replaced-layer': {
    source: shared.replace(
      'Layer.mergeAll(group)',
      'Layer.mergeAll(group).pipe(() => Layer.empty)',
    ),
  },
  'dead-return': {
    source: `${imports}${groups} function make() { if (false) return assembleEffectBffRuntime({api: fixtureApi, handlers}); return undefined; } export default make();`,
  },
  'replaced-factory': {
    source: `${imports}${groups} function make() { return assembleEffectBffRuntime({api: fixtureApi, handlers}); } make = () => undefined; export default make();`,
  },
  'destructured-factory': {
    source: `${imports}${groups} function make() { return assembleEffectBffRuntime({api: fixtureApi, handlers}); } [make] = [() => undefined]; export default make();`,
  },
  'replaced-builder': {
    source: `${direct}\nHttpApiBuilder.group = () => undefined;`,
  },
  shadowed: {
    source: `${imports}${groups} function make(assembleEffectBffRuntime) { return assembleEffectBffRuntime({api: fixtureApi, handlers}); } export default make(fake);`,
  },
  hoisted: {
    source: `${imports}${groups} function make() { return assembleEffectBffRuntime({api: fixtureApi, handlers}); function assembleEffectBffRuntime() {} } export default make();`,
  },
  'foreign-owner': {
    source: local,
    handlers: localHandlers.replaceAll(
      '../shared/api.ts',
      '../../foreign/shared/api.ts',
    ),
  },
  'symlink-owner': { source: local, symlink: true },
  'malformed-owner': { source: local, handlers: 'export const handlers = ;' },
  'duplicate-owner-binding': {
    source: local,
    handlers: `${localHandlers}\nimport { Layer as GovernedReadLayer } from 'effect'; const GovernedReadLayer = {};`,
  },
  'namespace-merge': {
    source: `${direct}\nnamespace HttpApiBuilder { export const group = () => undefined; }`,
  },
};
