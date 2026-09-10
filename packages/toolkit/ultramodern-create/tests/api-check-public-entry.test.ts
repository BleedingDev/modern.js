import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yaml } from '@modern-js/utils';
import { linkBuiltCodeTools } from './helpers/built-code-tools';

test('source qualification builds code-tools before generated API fixtures', () => {
  const workflow = yaml.load(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../.github/workflows/publish-bleedingdev.yml',
      ),
      'utf8',
    ),
  ) as {
    jobs: Record<string, { steps: Array<{ name?: string; run?: string }> }>;
  };
  const qualification = Object.values(workflow.jobs)
    .flatMap(job => job.steps)
    .find(step => step.name === 'Qualify release source');
  assert.ok(qualification?.run);
  const commands = qualification.run
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .map(line => line.replace(/\\$/u, ''))
    .join('\n');
  const build = /pnpm\s+((?:--filter "[^"]+"\s+)+)build/u.exec(commands);
  assert.ok(build, 'Source qualification must build dependency closures');
  assert.ok(build[1].includes('--filter "@modern-js/code-tools..."'));
  const tests = commands.indexOf(
    'pnpm --filter @modern-js/ultramodern-create test',
  );
  assert.ok(tests > build.index + build[0].length);
});

const valid = `
import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/bff-effect/effect-edge';
import { fixtureApi } from '../shared/api.ts';
const group = HttpApiBuilder.group(fixtureApi, 'fixture', h => h.handle('get', () => undefined));
const handlers = Layer.mergeAll(group);
const layer = HttpApiBuilder.layer(fixtureApi).pipe(Layer.provide(handlers));
export default defineEffectBff({ api: fixtureApi, layer });
`;

test('generated API fixtures use the published ESM and CJS validator with declaration output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-public-entry-'));
  try {
    linkBuiltCodeTools(path.join(root, 'node_modules'));
    // Repeated fixture setup must not replace the real package link.
    linkBuiltCodeTools(path.join(root, 'node_modules'));
    for (const format of ['module', 'commonjs']) {
      const load =
        format === 'module'
          ? "import { strictEffectRuntimeTopologyViolation as violation } from '@modern-js/code-tools/strict-effect-runtime';"
          : "const { strictEffectRuntimeTopologyViolation: violation } = require('@modern-js/code-tools/strict-effect-runtime');";
      const result = spawnSync(
        process.execPath,
        [
          `--input-type=${format}`,
          '--eval',
          `${load}
const valid = ${JSON.stringify(valid)};
const sources = [valid, '/* ' + valid + ' */ export default fake;',
  'const decoy = ' + JSON.stringify(valid) + '; export default fake;',
  valid.replace('defineEffectBff,', 'fake as defineEffectBff,')];
process.stdout.write(JSON.stringify(sources.map(source => violation(source) === undefined)));`,
        ],
        { cwd: root, encoding: 'utf8', timeout: 30_000 },
      );
      assert.equal(
        result.status,
        0,
        `${format}: ${result.stdout}${result.stderr}`,
      );
      assert.deepEqual(JSON.parse(result.stdout), [true, false, false, false]);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
