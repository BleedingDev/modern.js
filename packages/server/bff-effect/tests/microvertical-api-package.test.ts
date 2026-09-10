import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const packageRoot = path.resolve(__dirname, '..');
const requireCjs = createRequire(import.meta.url);

describe('packed micro-vertical API', () => {
  test('uses the consumer Effect singleton in both installed Node formats', () => {
    const fixture = mkdtempSync(path.join(tmpdir(), 'bff-microvertical-pack-'));
    try {
      const packed = spawnSync(
        'pnpm',
        ['pack', '--pack-destination', fixture, '--json'],
        {
          cwd: packageRoot,
          encoding: 'utf8',
        },
      );
      expect(packed.status, `${packed.stdout}\n${packed.stderr}`).toBe(0);
      const report = JSON.parse(packed.stdout) as { filename: string };
      const installed = path.join(
        fixture,
        'node_modules/@modern-js/bff-effect',
      );
      mkdirSync(installed, { recursive: true });
      const extract = spawnSync(
        'tar',
        [
          '-xzf',
          path.resolve(fixture, report.filename),
          '--strip-components=1',
          '-C',
          installed,
        ],
        { encoding: 'utf8' },
      );
      expect(extract.status, extract.stderr).toBe(0);
      symlinkSync(
        path.dirname(requireCjs.resolve('effect/package.json')),
        path.join(fixture, 'node_modules/effect'),
        'dir',
      );
      writeFileSync(
        path.join(fixture, 'verify.mjs'),
        `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Schema } from 'effect';
import * as esm from '@modern-js/bff-effect/microvertical-api';
const require = createRequire(import.meta.url);
const cjs = require('@modern-js/bff-effect/microvertical-api');
for (const api of [esm, cjs]) {
  assert.equal(api.MicroVerticalOperationContextSchema.fields.method, Schema.String);
  assert.equal(api.MicroVerticalBuildMarkerSchema.fields.build, Schema.String);
  assert.equal(api.MicroVerticalBuildMarkerSchema.fields.appId.to, Schema.String);
  const context = api.createMicroVerticalOperationContext({ method: 'GET', operationId: 'list', routePath: '/items' });
  assert.deepEqual(Schema.decodeUnknownSync(api.MicroVerticalOperationContextSchema)(context), context);
  assert.equal(Object.hasOwn(context, 'traceId'), false);
  assert.equal(Object.keys(api).length, 6);
}
`,
      );
      const imported = spawnSync(
        process.execPath,
        [path.join(fixture, 'verify.mjs')],
        { cwd: fixture, encoding: 'utf8' },
      );
      expect(imported.status, `${imported.stdout}\n${imported.stderr}`).toBe(0);

      const manifest = JSON.parse(
        readFileSync(path.join(installed, 'package.json'), 'utf8'),
      );
      const browser = manifest.exports['./microvertical-api'].default;
      expect(browser).toBe('./dist/esm/microvertical-api.mjs');
      const source = readFileSync(path.join(installed, browser), 'utf8');
      expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
      expect(
        [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
          match => match[1],
        ),
      ).toEqual(['effect']);
    } finally {
      rmSync(fixture, { force: true, recursive: true });
    }
  });
});
