import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { linkBuiltCodeTools } from './helpers/built-code-tools';

const valid = `
import { defineEffectBff, HttpApiBuilder, Layer } from '@modern-js/bff-effect/effect-edge';
import { fixtureApi } from '../shared/api.ts';
const group = HttpApiBuilder.group(fixtureApi, 'fixture', h => h.handle('get', () => undefined));
const handlers = Layer.mergeAll(group);
const layer = HttpApiBuilder.layer(fixtureApi).pipe(Layer.provide(handlers));
export default defineEffectBff({ api: fixtureApi, layer });
`;

test('published ESM and CJS validator entries reject generated-source decoys', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-api-public-entry-'));
  try {
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
