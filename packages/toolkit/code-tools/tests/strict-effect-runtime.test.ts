import { strictEffectRuntimeTopologyViolation as violation } from '../src/strict-effect-runtime';

const imports = `
import { assembleEffectBffRuntime } from '@fixture/shared-contracts/server/effect-bff-runtime';
import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/plugin-bff/effect-edge';
import { fixtureApi } from '../shared/api.ts';
`;
const group = `const group = HttpApiBuilder.group(fixtureApi, 'fixture', h => h.handle('get', () => undefined));
const handlers = Layer.mergeAll(group);`;
const shared = `${imports}${group}
export default assembleEffectBffRuntime({api: fixtureApi, handlers});`;
const direct = `${imports}${group}
const layer = HttpApiBuilder.layer(fixtureApi).pipe(Layer.provide(handlers));
export default defineEffectBff({api: fixtureApi, layer});`;

describe('strict Effect runtime binding provenance', () => {
  test.each([
    shared,
    direct,
    shared.replace(
      'export default assembleEffectBffRuntime({api: fixtureApi, handlers});',
      `export const make = () => { return assembleEffectBffRuntime({api: fixtureApi, handlers}); };
const runtime = make(); export default runtime;`,
    ),
    shared
      .replace(
        'assembleEffectBffRuntime }',
        'assembleEffectBffRuntime as assemble }',
      )
      .replace(
        'export default assembleEffectBffRuntime(',
        'export default assemble(',
      ),
    shared.replace(
      'const handlers',
      'function unrelated(Layer) { return Layer; } const handlers',
    ),
  ])('accepts genuine executable direct/shared roots', source => {
    expect(violation(source)).toBeUndefined();
  });

  test.each([
    // OntOS: published lint validators reject comment, string, and local strict-root spoofs, fixture 32.
    `${imports.replace('defineEffectBff,', 'fake as defineEffectBff,')}
const fixtureLayer = HttpApiBuilder.layer(fixtureApi).pipe(Layer.provide(fixtureHandlers));
defineEffectBff({api: fixtureApi, layer: fixtureLayer});`,
    direct.replace('defineEffectBff,', 'fake as defineEffectBff,'),
    direct.replace('export default defineEffectBff', 'defineEffectBff'),
    shared.replace(
      'export default assembleEffectBffRuntime',
      'assembleEffectBffRuntime',
    ),
    shared.replace(
      'assembleEffectBffRuntime }',
      'fake as assembleEffectBffRuntime }',
    ),
    shared.replace(
      'import { assembleEffectBffRuntime',
      'import type { assembleEffectBffRuntime',
    ),
    shared.replace('HttpApiBuilder, Layer', 'fake as HttpApiBuilder, Layer'),
    shared.replace("h => h.handle('get', () => undefined)", 'h => h'),
    shared.replace(
      'Layer.mergeAll(group)',
      'Layer.mergeAll(group).pipe(() => Layer.empty)',
    ),
    shared.replace('handlers});', 'handlers}) && fakeRuntime;'),
    shared.replace(
      'export default assembleEffectBffRuntime({api: fixtureApi, handlers});',
      `export const make = () => { if (false) return assembleEffectBffRuntime({api: fixtureApi, handlers}); return fakeRuntime; }; export default make();`,
    ),
    shared.replace(
      'export default assembleEffectBffRuntime({api: fixtureApi, handlers});',
      `const make = (assembleEffectBffRuntime) => assembleEffectBffRuntime({api: fixtureApi, handlers}); export default make(fake);`,
    ),
    shared.replace(
      'export default assembleEffectBffRuntime({api: fixtureApi, handlers});',
      `function make() { return assembleEffectBffRuntime({api: fixtureApi, handlers}); function assembleEffectBffRuntime() {} } export default make();`,
    ),
    `const decoy = ${JSON.stringify(shared)}; export default fake;`,
    `/* ${shared} */ export default fake;`,
  ])('rejects spoofed, shadowed, discarded and non-executable roots', source => {
    expect(violation(source)).toBeDefined();
  });

  test('classifies parser syntax and binder collision diagnostics as invalid source', () => {
    expect(violation('export const invalid = ;')).toBeDefined();
    // TypeScript parsing permits this import/value collision; scope crawling
    // reports it through Babel's Hub, not BABEL_PARSER_SYNTAX_ERROR.
    const duplicate = `import { assembleEffectBffRuntime } from '@fixture/shared-contracts/server/effect-bff-runtime';
import { HttpApiBuilder, Layer } from '@modern-js/plugin-bff/effect-edge';
import { Layer as GovernedReadLayer } from 'effect';
import { fixtureApi, governedHttpApi } from '../shared/api.ts';
const group = HttpApiBuilder.group(governedHttpApi, 'fixture', (handlers) => handlers.handle('reachable', () => undefined));
const GovernedReadLayer = {}; const handlers = Layer.mergeAll(group.pipe(GovernedReadLayer.provide(Layer.empty)));
export default assembleEffectBffRuntime({ api: fixtureApi, handlers: handlers });`;
    expect(violation(duplicate)).toBeDefined();
  });

  test('accepts native RPC composition and rejects transport or handler substitution', () => {
    const source = `import { defineEffectBff, HttpApi, Layer } from '@modern-js/plugin-bff/effect-edge';
import { fixtureRpcGroup } from '../shared/rpc.ts';
const api = HttpApi.make('transport'); const layer = Layer.empty;
const handlers = fixtureRpcGroup.toLayer(fixtureRpcGroup.of({ get: () => undefined }));
export default defineEffectBff({ api, layer, rpc: { group: fixtureRpcGroup, layer: handlers, path: '/rpc', serialization: 'json' } });`;
    const resolve = () => ({
      id: '/fixture/shared/rpc.ts',
      source: `import { RpcGroup, Rpc } from 'effect/unstable/rpc'; export const fixtureRpcGroup = RpcGroup.make(Rpc.make('get', {}));`,
    });
    expect(violation(source, resolve)).toBeUndefined();
    for (const invalid of [
      source.replace("HttpApi.make('transport')", 'fake'),
      source.replace('const layer = Layer.empty', 'const layer = fake'),
      source.replace("path: '/rpc'", "path: '/foreign'"),
      source.replace('fixtureRpcGroup.of({ get: () => undefined })', 'fake'),
    ])
      expect(violation(invalid, resolve)).toBeDefined();
  });
  test('follows owner-local handler modules and contract aliases, not foreign contracts', () => {
    const source = `${imports}import { handlers } from './handlers.ts'; export default assembleEffectBffRuntime({api: fixtureApi, handlers});`;
    const contract = {
      id: '/fixture/shared/api.ts',
      source:
        'export const fixtureApi = {}; export const aliasApi = fixtureApi;',
    };
    const resolve = (foreign: boolean) => (specifier: string) => {
      if (specifier === '../shared/api.ts') return contract;
      if (specifier === './handlers.ts')
        return {
          id: '/fixture/api/handlers.ts',
          source: `${imports.replace('fixtureApi }', 'aliasApi as fixtureApi }')}${group.replace('const handlers', 'export const handlers')}`,
          resolveImport: () =>
            foreign ? { ...contract, id: '/foreign/shared/api.ts' } : contract,
        };
      return undefined;
    };
    expect(violation(source, resolve(false))).toBeUndefined();
    expect(violation(source, resolve(true))).toBeDefined();
  });
});
