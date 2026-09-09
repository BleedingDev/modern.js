import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  genPluginImportsCode,
  getPluginsCode,
} from '../../src/plugins/deploy/utils/generator';

describe('deployed server plugin export interop', () => {
  for (const isESM of [false, true]) {
    it(`executes native and CommonJS factories in ${isESM ? 'ESM' : 'CommonJS'} launchers`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'server-plugin-interop-'));
      try {
        await writeFile(
          path.join(root, 'direct.cjs'),
          'module.exports = options => ({name: "direct", options});',
        );
        await writeFile(
          path.join(root, 'transpiled.cjs'),
          'Object.defineProperty(exports, "__esModule", {value: true}); exports.default = options => ({name: "transpiled", options}); exports.named = 42;',
        );
        await writeFile(
          path.join(root, 'native.mjs'),
          'export default options => ({name: "native", options});',
        );
        const plugins: Array<[string, Record<string, unknown>]> = [
          ['./direct.cjs', { value: 1 }],
          ['./transpiled.cjs', { value: 2 }],
          ['./native.mjs', { value: 3 }],
        ];
        const entry = path.join(root, isESM ? 'index.mjs' : 'index.cjs');
        await writeFile(
          entry,
          `${genPluginImportsCode(plugins, isESM)};\nconsole.log(JSON.stringify(${getPluginsCode(plugins)}));`,
        );
        expect(
          JSON.parse(
            execFileSync(process.execPath, [entry], { encoding: 'utf8' }),
          ),
        ).toEqual([
          { name: 'direct', options: { value: 1 } },
          { name: 'transpiled', options: { value: 2 } },
          { name: 'native', options: { value: 3 } },
        ]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
