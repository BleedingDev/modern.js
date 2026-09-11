import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('canonical federation public contracts', () => {
  test('the built Node federation entry preserves arbitrary file and data ESM remotes', async () => {
    const tempDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'modern-built-backend-federation-'),
    );
    const fileEntry = path.join(tempDirectory, 'file-remote.mjs');
    const createEntrySource = (name: string, brand: string) => `
      export function init() {}
      export function get(id) {
        if (id !== './effect-api') throw new Error('Unexpected expose ' + id);
        return async () => ({
          backendFederationContract: {
            compatibility: { build: 'built-21', unitId: 'built@21' },
            name: '${name}',
            runtimeFramework: 'effect',
            strictEffectApproach: true,
          },
          runtime: { brand: '${brand}' },
        });
      }
    `;

    try {
      await fs.writeFile(
        fileEntry,
        createEntrySource('builtFileBackend', 'built-file-esm'),
      );
      const dataEntry = `data:text/javascript;charset=utf-8,${encodeURIComponent(
        createEntrySource('builtDataBackend', 'built-data-esm'),
      )}`;
      const childScript = `
        const specifier = '@modern-js/plugin-bff-extensions/backend-federation/node';
        const { loadBackendFederatedEffectApi } = await import(specifier);
        const remotes = JSON.parse(process.env.MODERN_BUILT_ESM_REMOTES);
        const results = [];
        for (const remote of remotes) {
          const loaded = await loadBackendFederatedEffectApi({
            expected: { buildMarker: 'built-21', unitId: 'built@21' },
            hostName: 'built-node-compatibility-host',
            remote: { ...remote, type: 'module' },
        });
        results.push(loaded.runtime.brand);
      }
      process.stdout.write('MODERN_BUILT_RESULT=' + JSON.stringify({
          results,
        }));
      `;
      const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '--eval', childScript],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            MODERN_BUILT_ESM_REMOTES: JSON.stringify([
              {
                entry: pathToFileURL(fileEntry).href,
                name: 'builtFileBackend',
              },
              { entry: dataEntry, name: 'builtDataBackend' },
            ]),
          },
        },
      );
      const output = JSON.parse(
        stdout.slice(stdout.indexOf('MODERN_BUILT_RESULT=') + 20),
      );

      expect(output.results).toEqual(['built-file-esm', 'built-data-esm']);
    } finally {
      await fs.rm(tempDirectory, { force: true, recursive: true });
    }
  });
});
