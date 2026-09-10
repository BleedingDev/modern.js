import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  migrateBffRuntimeImports,
  migrateBffRuntimeSource,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/bff-runtime-import-migration';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';

for (const newline of ['\n', '\r\n']) {
  test(`Node facade migration splits owners and preserves aliases, comments and bodies (${JSON.stringify(newline)})`, () => {
    const body = `export const handler = make({ policy: 'consumer-selected' });${newline}// business comment${newline}`;
    const source = [
      '// imports remain documented',
      'import { defineEffectBff as make, /* API contract */ type EffectContext as Context,',
      'Effect /* namespace comment */ as Fx, HttpApiBuilder as Builder,',
      'loadBackendFederatedEffectApiFromManifest as load } from "@modern-js/plugin-bff/effect-server";',
      body,
    ].join(newline);
    const migrated = migrateBffRuntimeSource(source).source;
    assert.match(migrated, /import \* as Fx from "effect\/Effect"/u);
    assert.match(
      migrated,
      /defineEffectBff as make, type EffectContext as Context.*"@modern-js\/bff-effect\/effect"/u,
    );
    assert.match(
      migrated,
      /HttpApiBuilder as Builder.*"effect\/unstable\/httpapi"/u,
    );
    assert.match(
      migrated,
      /loadBackendFederatedEffectApiFromManifest as load.*"@modern-js\/plugin-bff-extensions\/backend-federation-manifest\/node"/u,
    );
    assert.ok(migrated.includes('/* API contract */'));
    assert.ok(migrated.includes('/* namespace comment */'));
    assert.ok(migrated.endsWith(body));
    if (newline === '\r\n') assert.doesNotMatch(migrated, /(?<!\r)\n/u);
    assert.equal(migrateBffRuntimeSource(migrated).source, migrated);
  });
}

test('worker context and federation bindings remain on their separate edge owners', () => {
  const source = `import { useEffectContext, type EffectContext, createBackendFederationRuntime as runtime } from '@modern-js/plugin-bff/effect-edge';\n`;
  const migrated = migrateBffRuntimeSource(source).source;
  assert.match(
    migrated,
    /useEffectContext, type EffectContext.*'@modern-js\/bff-effect\/effect-edge'/u,
  );
  assert.match(
    migrated,
    /createBackendFederationRuntime as runtime.*'@modern-js\/plugin-bff-extensions\/backend-federation\/edge'/u,
  );
  assert.doesNotMatch(migrated, /from '@modern-js\/bff-effect\/effect';/u);
});

test('type-only imports and reexports retain namespace and local binding identity', () => {
  const source = `import type { Effect as Fx, EffectContext as Context } from '@modern-js/plugin-bff/effect';
export { Layer as RuntimeLayer, defineEffectBff as define } from '@modern-js/plugin-bff/effect-server';`;
  const migrated = migrateBffRuntimeSource(source).source;
  assert.match(migrated, /import type \* as Fx from 'effect\/Effect'/u);
  assert.match(
    migrated,
    /import type \{ EffectContext as Context \} from '@modern-js\/bff-effect\/effect'/u,
  );
  assert.match(migrated, /export \* as RuntimeLayer from 'effect\/Layer'/u);
  assert.match(
    migrated,
    /export \{ defineEffectBff as define \} from '@modern-js\/bff-effect\/effect'/u,
  );
});

test('native Hono imports stay native and the retired Hono alias resolves to restored server', () => {
  const native = `import { Api, Get, Headers } from '@modern-js/plugin-bff/server';\nexport const policy = 'keep';`;
  assert.equal(migrateBffRuntimeSource(native).source, native);
  assert.equal(
    migrateBffRuntimeSource(native.replace('/server', '/hono-server')).source,
    native,
  );
  const mixed = migrateBffRuntimeSource(
    `import { Api, defineEffectBff } from '@modern-js/plugin-bff/server';`,
  ).source;
  assert.match(mixed, /Api.*'@modern-js\/plugin-bff\/server'/u);
  assert.match(mixed, /defineEffectBff.*'@modern-js\/bff-effect\/effect'/u);
});

test('single-owner client and data module declarations preserve surrounding source exactly', () => {
  for (const endpoint of [
    'effect-client',
    'effect-client-runtime',
    'data-platform',
  ]) {
    const source = `/* preserved */ export * from "@modern-js/plugin-bff/${endpoint}";\nconst text = '@modern-js/plugin-bff/${endpoint}';\n`;
    assert.equal(
      migrateBffRuntimeSource(source).source,
      source.replace(
        `"@modern-js/plugin-bff/${endpoint}"`,
        `"@modern-js/bff-effect/${endpoint}"`,
      ),
    );
  }
});

test.each([
  `import * as facade from '@modern-js/plugin-bff/effect';`,
  `import facade from '@modern-js/plugin-bff/effect-server';`,
  `export * from '@modern-js/plugin-bff/effect-edge';`,
  `import { Headers } from '@modern-js/plugin-bff/server';`,
  `import { Missing } from '@modern-js/plugin-bff/effect';`,
  `const runtime = import('@modern-js/plugin-bff/effect-edge');`,
  `const runtime = require('@modern-js/plugin-bff/effect-client');`,
  `const entry = '@modern-js/plugin-bff/effect'; const alias = entry; const runtime = import(alias);`,
  `const runtime = import('@modern-js/plugin-bff/' + name);`,
  `import { createRequire as makeRequire } from 'node:module'; const appRequire = makeRequire(import.meta.url); appRequire.resolve('@modern-js/plugin-bff/effect');`,
  `type Runtime = import('@modern-js/plugin-bff/effect-server').EffectContext;`,
])('ambiguous runtime references fail closed: %s', source => {
  assert.throws(
    () => migrateBffRuntimeSource(source, 'api/authored.ts'),
    /BFF runtime migration conflict: api\/authored.ts/u,
  );
});

test('business strings and unrelated resolve calls are preserved', () => {
  const source = `const path = '@modern-js/plugin-bff/effect';\nbusiness.resolve('@modern-js/plugin-bff/effect-server');\n// @modern-js/plugin-bff/effect-edge\n`;
  assert.equal(migrateBffRuntimeSource(source).source, source);
});

test.each([
  'const entry = "@modern-js/plugin-bff/effect"; function load(entry: string) { return import(entry); }',
  'const entry = "@modern-js/plugin-bff/effect"; { const entry = "other-package"; import(entry); }',
  'const entry = "@modern-js/plugin-bff/effect"; function load() { return import(entry); var entry = "other-package"; }',
  `const root = "other-package"; function load() { return import(\`\${root}/effect\`); }`,
  'function load(entry: string) { return import(entry); }',
  'function load(require: Function) { return require("@modern-js/plugin-bff/effect"); }',
  'import { createRequire } from "node:module"; function load(createRequire: Function) { const local = createRequire(); return local("@modern-js/plugin-bff/effect"); }',
  'const entry = "@modern-js/plugin-bff/effect"; try { throw "other-package"; } catch (entry) { import(entry); }',
  'const a = b; const b = a; import(a);',
])('unrelated or shadowed dynamic bindings retain their original source: %s', source => {
  const migrated = migrateBffRuntimeSource(source);
  assert.equal(migrated.source, source);
  assert.equal(migrated.dependencies.size, 0);
});

test.each([
  'const entry = "other-package"; function load() { const entry = "@modern-js/plugin-bff/effect"; return import(entry); }',
  'const entry = "@modern-js/plugin-bff/effect"; { const entry = "other-package"; import(entry); } import(entry);',
  `import { createRequire as make } from "node:module"; function load() { const local = make(import.meta.url); const root = "@modern-js/plugin-bff"; return local.resolve(\`\${root}/effect\`); }`,
  'function load() { const root = "@modern-js/plugin-"; const entry = (root + "bff/effect") as string; return import(entry); }',
  'import("\\x40modern-js/plugin-bff/effect");',
  'const entry = "@modern-js/plugin-bff/effect"; namespace Other { const entry = "other-package"; } import(entry);',
  'const entry = "@modern-js/plugin-bff/effect"; switch (import(entry)) { case 1: const entry = "other-package"; break; }',
  'const entry = "@modern-js/plugin-bff/effect"; function load(value = import(entry)) { var entry = "other-package"; }',
  'const entry = "@modern-js/plugin-bff/effect"; class Other { static { var entry = "other-package"; } } import(entry);',
])('retired references respect local bindings and decoded expressions: %s', source => {
  assert.throws(
    () => migrateBffRuntimeSource(source),
    /dynamic or require reference/u,
  );
});

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-bff-runtime-migration-'),
  );
  const write = (file: string, source: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  };
  write('package.json', '{"name":"fixture"}\n');
  write(
    'verticals/catalog/package.json',
    '{"name":"@fixture/catalog","dependencies":{"consumer":"keep","effect":"consumer-effect"}}\n',
  );
  return {
    root,
    write,
    read: (file: string) => fs.readFileSync(path.join(root, file), 'utf8'),
  };
}
const packageSource = {
  strategy: 'install' as const,
  modernPackageVersion: '3.9.0-ultramodern.5',
  aliasScope: 'bleedingdev',
  aliasPackageNamePrefix: 'modern-js-',
};
const cohort = {
  packages: ['@modern-js/bff-effect', '@modern-js/plugin-bff-extensions'].map(
    sourceName => ({
      sourceName,
      targetName: sourceName.replace('@modern-js/', '@bleedingdev/modern-js-'),
      version: packageSource.modernPackageVersion,
    }),
  ),
};

test.each([
  `const root = "@modern-js/plugin-bff"; const load = () => import(\`\${root}/effect\`);`,
  'function load() { const entry = "@modern-js/plugin-bff/effect"; return import(entry); }',
  'const load = () => import("@modern-js/plugin-" + "bff/effect");',
])('computed retired imports roll back the complete transaction: %s', dynamic => {
  const { root, write, read } = fixture();
  const source = `import { runEffectRequest } from '@modern-js/plugin-bff/effect-client';`;
  write('verticals/catalog/api/a.ts', source);
  write('verticals/catalog/api/z.ts', dynamic);
  write('scripts/generated.ts', 'export const generation = "before";');
  const manifest = read('verticals/catalog/package.json');
  try {
    const io = createMigrationIo(root, false);
    assert.throws(
      () =>
        io.transaction(() => {
          io.write(
            path.join(root, 'scripts/generated.ts'),
            'export const generation = "after";',
          );
          migrateBffRuntimeImports(io, packageSource, cohort);
        }),
      /dynamic or require reference/u,
    );
    assert.equal(
      read('scripts/generated.ts'),
      'export const generation = "before";',
    );
    assert.equal(read('verticals/catalog/api/a.ts'), source);
    assert.equal(read('verticals/catalog/api/z.ts'), dynamic);
    assert.equal(read('verticals/catalog/package.json'), manifest);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace migration preflights every source and authenticated owner before writing', () => {
  const { root, write, read } = fixture();
  const source = `import { Effect, defineEffectBff } from '@modern-js/plugin-bff/effect';\nexport const business = 'preserved';\n`;
  write('verticals/catalog/api/a.ts', source);
  write(
    'verticals/catalog/api/z.ts',
    `const runtime = import('@modern-js/plugin-bff/effect-edge');`,
  );
  const manifest = read('verticals/catalog/package.json');
  try {
    const io = createMigrationIo(root, false);
    assert.throws(
      () =>
        io.transaction(() =>
          migrateBffRuntimeImports(io, packageSource, cohort),
        ),
      /dynamic or require reference/u,
    );
    assert.equal(read('verticals/catalog/api/a.ts'), source);
    assert.equal(read('verticals/catalog/package.json'), manifest);
    fs.rmSync(path.join(root, 'verticals/catalog/api/z.ts'));
    assert.throws(
      () => migrateBffRuntimeImports(io, packageSource, { packages: [] }),
      /absent from the authenticated target cohort/u,
    );
    assert.equal(read('verticals/catalog/api/a.ts'), source);
    assert.equal(read('verticals/catalog/package.json'), manifest);
    io.transaction(() => migrateBffRuntimeImports(io, packageSource, cohort));
    const updated = JSON.parse(read('verticals/catalog/package.json'));
    assert.equal(
      updated.dependencies['@modern-js/bff-effect'],
      'npm:@bleedingdev/modern-js-bff-effect@3.9.0-ultramodern.5',
    );
    assert.equal(updated.dependencies.effect, 'consumer-effect');
    assert.equal(updated.dependencies.consumer, 'keep');
    assert.ok(
      read('verticals/catalog/api/a.ts').endsWith(
        "export const business = 'preserved';\n",
      ),
    );
    const result = read('verticals/catalog/api/a.ts');
    io.transaction(() => migrateBffRuntimeImports(io, packageSource, cohort));
    assert.equal(read('verticals/catalog/api/a.ts'), result);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback restores staged source and manifests if a late write fails', () => {
  const { root, write, read } = fixture();
  const source = `import { runEffectRequest } from '@modern-js/plugin-bff/effect-client';`;
  write('verticals/catalog/api/index.ts', source);
  const manifest = read('verticals/catalog/package.json');
  try {
    const io = createMigrationIo(root, false);
    const writeFile = io.write.bind(io);
    io.write = (file, content) => {
      if (file.endsWith('package.json')) throw new Error('owned write failure');
      return writeFile(file, content);
    };
    assert.throws(
      () =>
        io.transaction(() =>
          migrateBffRuntimeImports(io, packageSource, cohort),
        ),
      /owned write failure/u,
    );
    assert.equal(read('verticals/catalog/api/index.ts'), source);
    assert.equal(read('verticals/catalog/package.json'), manifest);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
