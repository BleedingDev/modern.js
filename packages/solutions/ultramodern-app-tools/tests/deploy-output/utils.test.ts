import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const sourcePath = path.resolve(
  __dirname,
  '../../../app-tools/src/plugins/deploy/utils/index.ts',
);

describe('deploy utils', () => {
  it('resolves from the package when a consumer cwd has no app-tools dependencies', () => {
    const consumerDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'app-tools-deploy-consumer-'),
    );
    const bundlePath = path.join(consumerDirectory, 'resolver.mjs');
    const utilsStubPath = path.join(consumerDirectory, 'modern-utils.mjs');

    fs.writeFileSync(
      utilsStubPath,
      `export const dynamicImport = specifier => import(specifier);
export const fs = { existsSync: () => false, readFile: async () => '' };
export const getMeta = name => name;
export const ROUTE_SPEC_FILE = 'route.json';
export const SERVER_DIR = 'server';
`,
    );

    try {
      buildSync({
        alias: { '@modern-js/utils': utilsStubPath },
        bundle: true,
        define: {
          __dirname: JSON.stringify(path.dirname(sourcePath)),
          __filename: JSON.stringify(sourcePath),
        },
        entryPoints: [sourcePath],
        external: ['node:*'],
        format: 'esm',
        outfile: bundlePath,
        platform: 'node',
      });

      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { resolveESMDependency } from ${JSON.stringify(pathToFileURL(bundlePath).href)};
const resolved = await resolveESMDependency('mlly');
if (!resolved?.endsWith('/dist/index.mjs')) throw new Error(String(resolved));
const missing = await resolveESMDependency('@modern-js/definitely-not-a-package');
if (missing !== undefined) throw new Error(String(missing));
console.log('resolved', resolved);`,
        ],
        { cwd: consumerDirectory, encoding: 'utf8' },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/resolved .*dist\/index\.mjs/);
      expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    } finally {
      fs.rmSync(consumerDirectory, { recursive: true, force: true });
    }
  });
});
