import { strictEffectRuntimeTopologyViolation as violation } from '../src/strict-effect-runtime';

const imports = `
import { assembleEffectBffRuntime } from '@fixture/shared-contracts/server/effect-bff-runtime';
import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/bff-effect/effect-edge';
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
  test('proves parameterized factories and handler-local declarations without trusting parameters as topology', () => {
    const source = `${imports}
const make = (...args: readonly [unknown]) => {
  const [dependency] = args;
  const group = HttpApiBuilder.group(fixtureApi, 'fixture', handlers => {
    const handle = () => undefined;
    return handlers.handle('get', handle);
  });
  const handlers = Layer.mergeAll(group).pipe(Layer.provide(dependency));
  return assembleEffectBffRuntime({api: fixtureApi, handlers});
};
export default make(Layer.empty);`;
    expect(violation(source)).toBeUndefined();
    for (const invalid of [
      source.replace('handlers});', 'handlers: dependency});'),
      source.replace('api: fixtureApi', 'api: dependency'),
      source.replace(
        'return handlers.handle',
        'if (false) return handlers.handle',
      ),
      source.replace('return handlers.handle', 'return fake.handle'),
      source.replace(
        'return assembleEffectBffRuntime',
        'if (false) return assembleEffectBffRuntime',
      ),
      source.replace(
        'const [dependency] = args;',
        'const [assembleEffectBffRuntime] = args;',
      ),
      source.replace(
        'const handle = () => undefined;',
        'const handle = () => undefined; const handlers = fake;',
      ),
      source.replace(
        'return handlers.handle',
        'handlers = fake; return handlers.handle',
      ),
    ])
      expect(violation(invalid)).toBeDefined();
  });

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
  ])('accepts genuine executable direct/shared roots', source => {
    expect(violation(source)).toBeUndefined();
  });

  test.each([
    // OntOS: published lint validators reject string and local strict-root spoofs, fixture 32.
    `${imports.replace('defineEffectBff,', 'fake as defineEffectBff,')}
const fixtureLayer = HttpApiBuilder.layer(fixtureApi).pipe(Layer.provide(fixtureHandlers));
defineEffectBff({api: fixtureApi, layer: fixtureLayer});`,
    direct.replace('export default defineEffectBff', 'defineEffectBff'),
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
    shared.replace(
      'export default assembleEffectBffRuntime({api: fixtureApi, handlers});',
      `export const make = () => { if (false) return assembleEffectBffRuntime({api: fixtureApi, handlers}); return fakeRuntime; }; export default make();`,
    ),
    `const decoy = ${JSON.stringify(shared)}; export default fake;`,
  ])('rejects spoofed, shadowed, discarded and non-executable roots', source => {
    expect(violation(source)).toBeDefined();
  });

  test('classifies parser syntax and binder collision diagnostics as invalid source', () => {
    expect(violation('export const invalid = ;')).toBeDefined();
    // TypeScript parsing permits this import/value collision; scope crawling
    // reports it through Babel's Hub, not BABEL_PARSER_SYNTAX_ERROR.
    const duplicate = `import { assembleEffectBffRuntime } from '@fixture/shared-contracts/server/effect-bff-runtime';
import { HttpApiBuilder, Layer } from '@modern-js/bff-effect/effect-edge';
import { Layer as GovernedReadLayer } from 'effect';
import { fixtureApi, governedHttpApi } from '../shared/api.ts';
const group = HttpApiBuilder.group(governedHttpApi, 'fixture', (handlers) => handlers.handle('reachable', () => undefined));
const GovernedReadLayer = {}; const handlers = Layer.mergeAll(group.pipe(GovernedReadLayer.provide(Layer.empty)));
export default assembleEffectBffRuntime({ api: fixtureApi, handlers: handlers });`;
    expect(violation(duplicate)).toBeDefined();
  });

  test('accepts native RPC composition and rejects transport or handler substitution', () => {
    const source = `import { defineEffectBff, HttpApi, Layer } from '@modern-js/bff-effect/effect-edge';
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

describe('canonical Effect package provenance', () => {
  const node = direct.replace(
    "import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/bff-effect/effect-edge';",
    "import { defineEffectBff } from '@modern-js/bff-effect/effect';\nimport { HttpApiBuilder } from 'effect/unstable/httpapi';\nimport * as Layer from 'effect/Layer';",
  );
  test('accepts Node runtime imports split by owning module and preserves namespace aliases', () => {
    expect(violation(node)).toBeUndefined();
    const aliased = node
      .replace('defineEffectBff }', 'defineEffectBff as createRuntime }')
      .replace(
        'export default defineEffectBff(',
        'export default createRuntime(',
      )
      .replace('HttpApiBuilder }', 'HttpApiBuilder as Builder }')
      .replaceAll('HttpApiBuilder.', 'Builder.')
      .replace('import * as Layer', 'import * as RuntimeLayer')
      .replaceAll('Layer.', 'RuntimeLayer.');
    expect(violation(aliased)).toBeUndefined();
  });
  test.each([
    node.replace('import * as Layer', 'import type * as Layer'),
    node.replace('import * as Layer', "import { '*' as Layer }"),
    node.replace('import * as Layer', 'import { Layer }'),
    node.replace("'effect/Layer'", "'effect/Option'"),
    node.replace("'effect/unstable/httpapi'", "'@foreign/httpapi'"),
    node.replace(
      "'@modern-js/bff-effect/effect'",
      "'@modern-js/plugin-bff/server'",
    ),
    node.replace('HttpApiBuilder }', 'fake as HttpApiBuilder }'),
    `${node}\nLayer.mergeAll = () => undefined;`,
    node.replace('const handlers', 'const Layer = fake; const handlers'),
  ])('rejects non-executable or foreign Node bindings', source => {
    expect(violation(source)).toBeDefined();
  });
});
