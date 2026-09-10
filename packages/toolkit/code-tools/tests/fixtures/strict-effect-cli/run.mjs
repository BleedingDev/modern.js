import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contract, localHandlers, negatives, positives } from './cases.mjs';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const require = createRequire(path.join(packageRoot, 'package.json'));
const generator = path.resolve(
  packageRoot,
  '../ultramodern-create/dist/esm-node/ultramodern-workspace/api',
);
const { createApiServiceEntry } = await import(
  pathToFileURL(path.join(generator, 'service.js'))
);
const { createSharedApi } = await import(
  pathToFileURL(path.join(generator, 'shared.js'))
);
const cleanOutput =
  /^(?:(?:\r?\n)?Found 0 warnings and 0 errors\.\r?\nFinished in \d+(?:\.\d+)?(?:ms|s) on [1-9]\d* files? with \d+ rules using [1-9]\d* threads?\.\r?\n)?$/u;
const topologyFailure = /Generated API entries must export defineEffectBff/u;
const toolFailure = /Strict Effect API analysis failed/u;

function write(root, filename, source) {
  const target = path.join(root, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}
function binary(name) {
  const manifestPath = require.resolve(`${name}/package.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return path.join(
    path.dirname(manifestPath),
    typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[name],
  );
}
function run(args, root, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 45_000,
    env: { ...process.env, TMPDIR: root, ...extraEnv },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return { status: result.status, output: result.stdout + result.stderr };
}
function fixture(root, name, value) {
  const owner = `verticals/${name}`;
  write(root, `${owner}/api/index.ts`, value.source);
  write(root, `${owner}/shared/api.ts`, value.contract ?? contract);
  if (value.handlers) write(root, `${owner}/api/handlers.ts`, value.handlers);
  if (value.symlink)
    fs.symlinkSync(
      path.join(root, 'verticals/foreign/api/handlers.ts'),
      path.join(root, owner, 'api/handlers.ts'),
    );
  return `${owner}/api/index.ts`;
}

for (const format of ['cjs', 'esm', 'esm-node']) {
  test(`${format}: real CLI accepts formatted generated/native APIs and rejects provenance spoofs and compiler failures`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-strict-cli-'));
    try {
      // A release-shaped package with exactly one built format: no src fallback,
      // no Rule.create mock, no fixture-level plugin namespace workaround.
      const staged = path.join(root, 'tool');
      fs.cpSync(
        path.join(packageRoot, 'dist', format),
        path.join(staged, 'dist', format),
        {
          recursive: true,
        },
      );
      write(
        staged,
        'package.json',
        JSON.stringify({ name: '@modern-js/code-tools', type: 'module' }),
      );
      fs.mkdirSync(path.join(staged, 'node_modules'));
      for (const name of [
        'oxlint',
        '@babel/parser',
        '@babel/traverse',
        '@babel/types',
      ]) {
        const target = path.join(staged, 'node_modules', name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.symlinkSync(
          path.dirname(require.resolve(`${name}/package.json`)),
          target,
          'dir',
        );
      }
      write(
        root,
        'forbid-compiler.mjs',
        `
        import childProcess from 'node:child_process';
        import { syncBuiltinESMExports } from 'node:module';
        if (process.argv[1]?.endsWith('/bin/oxlint')) {
          for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'])
            childProcess[key] = () => { throw new Error('unexpected-compiler-subprocess'); };
          syncBuiltinESMExports();
        }
      `,
      );
      const noCompiler = {
        GITHUB_ACTIONS: 'true',
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(path.join(root, 'forbid-compiler.mjs')).href}`,
      };
      const cli = pathToFileURL(
        path.join(
          staged,
          'dist',
          format,
          `cli/oxlint.${format === 'cjs' ? 'cjs' : 'js'}`,
        ),
      ).href;
      const invoke = (targets, env) =>
        run(
          [
            '--input-type=module',
            '--eval',
            `
        import { runOxlintRules, printOxlintOutput } from ${JSON.stringify(cli)};
        const result = runOxlintRules({ cwd: ${JSON.stringify(root)}, targets: ${JSON.stringify(targets)}, rules: { 'ultramodern/strict-effect-api-boundaries': 'error' } });
        printOxlintOutput(result); process.exitCode = result.exitCode;
      `,
          ],
          root,
          env,
        );
      write(root, 'verticals/foreign/shared/api.ts', contract);
      write(root, 'verticals/foreign/api/handlers.ts', localHandlers);
      const valid = Object.entries(positives).map(([name, value]) =>
        fixture(root, name, value),
      );
      // One representative ERP service entry from this checkout's release-built generator.
      {
        const id = 'finance';
        const options = { scope: 'regression-erp' };
        valid.push(
          fixture(root, id, {
            source: createApiServiceEntry({ id }, '../shared/api.ts', options),
            contract: createSharedApi({ id }, options),
          }),
        );
      }
      const invalid = Object.entries(negatives).map(([name, value]) =>
        fixture(root, name, value),
      );
      write(root, '.oxfmtrc.json', '{}');
      const formatted = run(
        [
          binary('oxfmt'),
          ...valid,
          ...invalid,
          '--config',
          path.join(root, '.oxfmtrc.json'),
        ],
        root,
      );
      assert.equal(formatted.status, 0, formatted.output);
      const accepted = invoke(valid, noCompiler);
      assert.equal(accepted.status, 0, accepted.output);
      assert.match(accepted.output, cleanOutput);
      const rejected = invoke(invalid, noCompiler);
      assert.equal(rejected.status, 1, rejected.output);
      assert.match(rejected.output, topologyFailure);
      assert.doesNotMatch(
        rejected.output,
        /Error running JS plugin|Strict Effect API analysis failed/u,
      );
      for (const target of invalid)
        assert.ok(
          rejected.output.includes(target),
          `Missing rejection for ${target}:\n${rejected.output}`,
        );
      // Inject an analyzer infrastructure failure, not an invalid source or rule
      // mock. It must retain its cause and never masquerade as topology failure.
      for (const errorType of ['Error', 'SyntaxError', 'TypeError']) {
        write(
          root,
          'broken-parser.mjs',
          `export function parse(){throw new ${errorType}("deliberate-parser-failure")} export const parseExpression = parse;`,
        );
        write(
          root,
          'fail-parser.mjs',
          `
        import { registerHooks } from 'node:module';
        registerHooks({ resolve(specifier, context, nextResolve) {
          if (specifier === '@babel/parser') return {
            url: ${JSON.stringify(pathToFileURL(path.join(root, 'broken-parser.mjs')).href)},
            shortCircuit: true,
          };
          return nextResolve(specifier, context);
        } });
      `,
        );
        const failed = invoke([valid[0]], {
          ...noCompiler,
          NODE_OPTIONS: `${noCompiler.NODE_OPTIONS} --import=${pathToFileURL(path.join(root, 'fail-parser.mjs')).href}`,
        });
        assert.equal(failed.status, 1, failed.output);
        assert.match(failed.output, toolFailure);
        assert.match(failed.output, /deliberate-parser-failure/u);
        assert.match(failed.output, /Error running JS plugin/u);
        assert.doesNotMatch(failed.output, topologyFailure);
        assert.ok(
          failed.output.includes(path.normalize(valid[0])),
          failed.output,
        );
      }
      assert.deepEqual(
        fs
          .readdirSync(root)
          .filter(name => name.startsWith('modern-code-tools-oxlint-')),
        [],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
