import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';

// Native Node imports deliberately bypass Rstest's source aliases and transforms.
const { compatibleRequire } = await import(
  '../../../../utils/dist/esm-node/index.mjs'
);
const require = createRequire(import.meta.url);
const {
  compatibleRequire: compatibleRequireCJS,
} = require('../../../../utils/dist/cjs/index.js');
const directory = mkdtempSync(join(tmpdir(), 'modern-utils-interop-'));
after(() => rmSync(directory, { recursive: true, force: true }));
const fixture = (name, source) => {
  const path = join(directory, name);
  writeFileSync(path, source);
  return path;
};
const factory =
  'function factory(options) { return { name: "plugin", options }; }';
const functionModules = [
  ['raw.cjs', `module.exports = ${factory}`],
  [
    'transpiled.cjs',
    `Object.defineProperty(exports, '__esModule', { value: true }); exports.default = ${factory}; exports.named = 'named';`,
  ],
  [
    'nested.cjs',
    `module.exports = { __esModule: true, default: { __esModule: true, default: ${factory} } };`,
  ],
  [
    'getter.cjs',
    `Object.defineProperty(exports, '__esModule', { value: true }); Object.defineProperty(exports, 'default', { enumerable: true, get: () => factory }); ${factory}`,
  ],
  ['pure.mjs', `export default ${factory}; export const named = 'named';`],
];
for (const [name, source] of functionModules) {
  test(`built ESM invokes ${name} server factory`, async () => {
    const path = fixture(name, source);
    const loaded = await compatibleRequire(path);
    assert.equal(typeof loaded, 'function');
    assert.deepEqual(loaded({ enabled: true }), {
      name: 'plugin',
      options: { enabled: true },
    });
    if (name !== 'nested.cjs')
      assert.equal(typeof (await compatibleRequireCJS(path)), 'function');
    const raw = await compatibleRequire(path, false);
    assert.equal(raw, await import(pathToFileURL(path).href));
    if (name === 'transpiled.cjs') {
      assert.equal(typeof raw.default.default, 'function');
      assert.equal(raw.default.named, 'named');
    }
    if (name === 'pure.mjs') assert.equal(raw.named, 'named');
  });
}

for (const [name, source, expected] of [
  [
    'payload.cjs',
    'module.exports = { default: "payload", named: "named" };',
    { default: 'payload', named: 'named' },
  ],
  ['named.cjs', 'exports.named = "named";', { named: 'named' }],
  [
    'tagged-named.cjs',
    'module.exports = { __esModule: true, named: "named" };',
    { __esModule: true, named: 'named' },
  ],
  [
    'false-tag.cjs',
    'module.exports = { __esModule: false, default: "payload" };',
    { __esModule: false, default: 'payload' },
  ],
  ['null.cjs', 'module.exports = null;', null],
  ['primitive.cjs', 'module.exports = 0;', 0],
  [
    'default-null.cjs',
    'module.exports = { __esModule: true, default: null };',
    null,
  ],
  ['default-zero.mjs', 'export default 0;', 0],
  ['default-undefined.mjs', 'export default undefined;', undefined],
  [
    'esm-payload.mjs',
    'export default { __esModule: true, default: "payload" };',
    { __esModule: true, default: 'payload' },
  ],
  [
    'esm-cjs-export.mjs',
    'export default { __esModule: true, default: "payload" }; const cjs = "separate"; export { cjs as "module.exports" };',
    { __esModule: true, default: 'payload' },
  ],
]) {
  test(`built ESM preserves ${name}`, async () => {
    const path = fixture(name, source);
    assert.deepEqual(await compatibleRequire(path), expected);
    assert.equal(
      await compatibleRequire(path, false),
      await import(pathToFileURL(path).href),
    );
  });
}

test('built ESM retains named-only native namespace', async () => {
  const path = fixture('named.mjs', 'export const named = "named";');
  const raw = await import(pathToFileURL(path).href);
  assert.equal(await compatibleRequire(path), raw);
  assert.equal(await compatibleRequire(path, false), raw);
  assert.equal(raw.named, 'named');
});

test('built ESM preserves callable exports with payload properties', async () => {
  const path = fixture(
    'callable.cjs',
    `module.exports = ${factory}; module.exports.__esModule = true; module.exports.default = 'payload';`,
  );
  const loaded = await compatibleRequire(path);
  assert.equal(typeof loaded, 'function');
  assert.equal(loaded.default, 'payload');
});

test('built ESM terminates cyclic tagged namespaces', async () => {
  const path = fixture(
    'cycle.cjs',
    'exports.__esModule = true; exports.default = exports;',
  );
  const loaded = await compatibleRequire(path);
  assert.equal(loaded.default, loaded);
});

test('built ESM loads JSON without changing payload or interop=false', async () => {
  const payload = { __esModule: true, default: 'payload', named: 'named' };
  const path = fixture('data.json', JSON.stringify(payload));
  assert.deepEqual(await compatibleRequire(path), payload);
  assert.deepEqual(await compatibleRequire(path, false), payload);
  assert.deepEqual(await compatibleRequireCJS(path), payload);
});

test('built ESM preserves development cache-busting and factory interop', async () => {
  const previous = process.env.NODE_ENV;
  const now = Date.now;
  try {
    process.env.NODE_ENV = 'development';
    Date.now = () => 100;
    const path = fixture('reload.mjs', 'export default "first";');
    assert.equal(await compatibleRequire(path), 'first');
    writeFileSync(path, 'export default "second";');
    Date.now = () => 101;
    assert.equal(await compatibleRequire(path), 'second');
    const plugin = fixture(
      'development.cjs',
      `Object.defineProperty(exports, '__esModule', { value: true }); exports.default = ${factory};`,
    );
    assert.equal(typeof (await compatibleRequire(plugin)), 'function');
    const raw = await compatibleRequire(path, false);
    assert.equal(raw, await import(`${pathToFileURL(path).href}?t=101`));
  } finally {
    Date.now = now;
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
