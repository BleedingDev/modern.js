import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PKG_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const compilerManifestPath = require.resolve('typescript/package.json');
const TSC_BIN = path.resolve(
  path.dirname(compilerManifestPath),
  require(compilerManifestPath).bin.tsc,
);

const collectDtsFiles = (dir: string, files: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectDtsFiles(fullPath, files);
    } else if (entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
};

describe('shipped .d.ts files', () => {
  it('resolves every relative import and re-export through TypeScript', () => {
    const result = spawnSync(
      process.execPath,
      [
        TSC_BIN,
        '--ignoreConfig',
        '--noEmit',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        '--target',
        'esnext',
        '--types',
        'node,react',
        ...collectDtsFiles(PKG_ROOT).map(file => path.relative(PKG_ROOT, file)),
      ],
      {
        cwd: PKG_ROOT,
        encoding: 'utf8',
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    const diagnostics = `${result.stdout}${result.stderr}`
      .split(/\r?\n/u)
      .filter(Boolean);
    expect(diagnostics).toEqual([]);
  });
});
