import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveEffectTsgoCompiler } from '@modern-js/app-tools-extensions/config';
import { effectDiagnostics } from '../../packages/toolkit/ultramodern-create/src/ultramodern-workspace/effect-diagnostics.ts';
import { createCriticalCompilerOptions } from '../tsgo-critical.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('critical Effect TS-Go compiler resolves through the public framework API', () => {
  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, 'package.json'), 'utf-8'),
  );
  assert.equal(
    packageJson.devDependencies?.['@modern-js/app-tools-extensions'],
    'workspace:*',
  );
  const compiler = resolveEffectTsgoCompiler({ from: import.meta.url });
  assert.equal(existsSync(compiler), true);
  assert.equal(compiler.includes('node_modules/.bin/effect-tsgo'), false);
});

const effectFrameworkConfig = 'packages/server/bff-effect/tsconfig.json';
const frameworkConfigs = [
  'packages/runtime/plugin-tanstack/tsconfig.tsgo.json',
  'packages/runtime/plugin-runtime/tsconfig.tsgo.json',
];
const consumerConfigs = [
  'tests/integration/routes-tanstack/tsconfig.json',
  'tests/integration/routes-tanstack-mf/mf-host/tsconfig.typecheck.json',
  'tests/integration/routes-tanstack-mf/mf-remote/tsconfig.typecheck.json',
  'tests/integration/routes-tanstack-mf/mf-remote-2/tsconfig.typecheck.json',
  'tests/integration/bff-effect/tsconfig.json',
  'tests/integration/superapp-portfolio/tsconfig.json',
  'tests/integration/bff-cross-project/bff-client-app/tsconfig.json',
];

test('all ten critical configs remain covered; consumers keep every strict diagnostic', () => {
  const configs = readFileSync(
    join(repoRoot, 'scripts/tsgo-critical.txt'),
    'utf8',
  )
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  assert.deepEqual(configs, [
    effectFrameworkConfig,
    ...frameworkConfigs,
    ...consumerConfigs,
  ]);
  const strict = Object.fromEntries(
    effectDiagnostics.map(name => [name, 'error']),
  );
  for (const config of [
    effectFrameworkConfig,
    ...consumerConfigs,
    'packages/new-framework/tsconfig.json',
  ]) {
    const {
      plugins: [plugin],
    } = createCriticalCompilerOptions(config);
    assert.deepEqual(plugin.diagnosticSeverity, strict);
    assert.equal(plugin.ignoreEffectErrorsInTscExitCode, false);
    assert.equal(plugin.ignoreEffectWarningsInTscExitCode, false);
    assert.equal(plugin.ignoreEffectSuggestionsInTscExitCode, false);
  }
  for (const config of frameworkConfigs) {
    const {
      plugins: [plugin],
    } = createCriticalCompilerOptions(config);
    assert.deepEqual(plugin.diagnosticSeverity, {
      ...strict,
      asyncFunction: 'off',
      processEnv: 'off',
    });
    assert.equal(plugin.diagnosticSeverity.strictBooleanExpressions, 'error');
  }
});

function compileFixture(config, source) {
  const root = mkdtempSync(join(tmpdir(), 'um-critical-diagnostics-'));
  try {
    // Resolve real installed Effect and Node declarations through their declared
    // framework consumer. No mock compiler or global dependency is involved.
    const require = createRequire(
      join(repoRoot, 'packages/server/bff-effect/package.json'),
    );
    const effectRoot = dirname(require.resolve('effect/package.json'));
    const nodeTypesRoot = dirname(require.resolve('@types/node/package.json'));
    writeFileSync(join(root, 'input.ts'), source);
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ES2022',
          types: ['node'],
          typeRoots: [dirname(nodeTypesRoot)],
          paths: { effect: [join(effectRoot, 'dist/index.d.ts')] },
          ...createCriticalCompilerOptions(config),
        },
        files: ['input.ts'],
      }),
    );
    const result = spawnSync(
      resolveEffectTsgoCompiler({ from: import.meta.url }),
      [
        '--noEmit',
        '--pretty',
        'false',
        '--checkers',
        '2',
        '-p',
        join(root, 'tsconfig.json'),
      ],
      { encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(result.error, undefined);
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('native Promise APIs and build constants pass only the framework profile', () => {
  const source = `export async function nativeHandler(): Promise<string> {
  return process.env.MODERN_LIB_FORMAT ?? 'esm';
}
`;
  const framework = compileFixture(frameworkConfigs[0], source);
  assert.equal(framework.status, 0, framework.output);
  for (const config of [effectFrameworkConfig, consumerConfigs[0]]) {
    const strict = compileFixture(config, source);
    assert.equal(strict.status, 1, strict.output);
    assert.match(strict.output, /effect\(asyncFunction\)/);
    assert.match(strict.output, /effect\(processEnv\)/);
  }
});

test('Effect correctness and TypeScript errors remain fatal in framework and strict profiles', () => {
  const source = `import { Effect } from 'effect';
Effect.succeed(1);
export const environment = Effect.sync(() => process.env.VALUE);
export const invalid: string = 1;
`;
  for (const config of [
    frameworkConfigs[0],
    effectFrameworkConfig,
    consumerConfigs[0],
  ]) {
    const result = compileFixture(config, source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /effect\(floatingEffect\)/);
    assert.match(result.output, /effect\(processEnvInEffect\)/);
    assert.match(result.output, /TS2322/);
  }
});
