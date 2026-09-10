import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveRequiredPackageDistEntries } from './modernTestUtils';

function createPackageDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'modernjs-package-dist-'));
}

function removePackageDir(packageDir: string) {
  fs.rmSync(packageDir, { recursive: true, force: true });
}

describe('resolveRequiredPackageDistEntries', () => {
  test('keeps concrete export targets as required files', () => {
    const packageDir = createPackageDir();
    const entry = path.join(packageDir, 'dist', 'index.mjs');

    try {
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      fs.writeFileSync(entry, 'export {}');

      expect(
        resolveRequiredPackageDistEntries(packageDir, {
          exports: { '.': './dist/index.mjs' },
        }),
      ).toEqual([entry]);
    } finally {
      removePackageDir(packageDir);
    }
  });

  test('expands wildcard exports to every concrete file match', () => {
    const packageDir = createPackageDir();
    const entries = [
      path.join(packageDir, 'dist', 'rsc-disabled', 'client.mjs'),
      path.join(packageDir, 'dist', 'rsc-disabled', 'server.mjs'),
    ];

    try {
      fs.mkdirSync(path.dirname(entries[0]), { recursive: true });
      for (const entry of entries) {
        fs.writeFileSync(entry, 'export {}');
      }

      expect(
        resolveRequiredPackageDistEntries(packageDir, {
          exports: { './rsc-disabled/*': './dist/rsc-disabled/*.mjs' },
        }),
      ).toEqual(entries);
    } finally {
      removePackageDir(packageDir);
    }
  });

  test('retains an unmatched wildcard as an explicit missing entry', () => {
    const packageDir = createPackageDir();
    const missingPattern = path.join(packageDir, 'dist', 'missing', '*.mjs');

    try {
      expect(
        resolveRequiredPackageDistEntries(packageDir, {
          exports: { './missing/*': './dist/missing/*.mjs' },
        }),
      ).toEqual([missingPattern]);
      expect(fs.existsSync(missingPattern)).toBe(false);
    } finally {
      removePackageDir(packageDir);
    }
  });
});
