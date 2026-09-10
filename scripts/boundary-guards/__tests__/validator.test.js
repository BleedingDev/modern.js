const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { validateImportGuards } = require('../validator');

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'modern-boundary-guards-'));

const removeDir = directory => {
  fs.rmSync(directory, { recursive: true, force: true });
};

test('validateImportGuards detects banned imports', () => {
  const dir = makeTempDir();
  try {
    const filePath = path.join(dir, 'input.ts');
    const allowedFilePath = path.join(dir, 'allowed.ts');
    fs.writeFileSync(
      filePath,
      "import exampleModule from '@modules/example-module';\n",
    );
    fs.writeFileSync(allowedFilePath, 'export const value = true;\n');

    const report = validateImportGuards({
      importGuards: [
        {
          id: 'no-domain',
          roots: [dir],
          bannedImportPatterns: ['^@modules/[^/]+'],
        },
      ],
      rootDir: process.cwd(),
      scanExtensions: ['.ts'],
    });

    assert.equal(report.inspectedFiles, 2);
    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].guardId, 'no-domain');
  } finally {
    removeDir(dir);
  }
});

test('validateImportGuards detects banned re-export specifiers', () => {
  const dir = makeTempDir();
  try {
    const filePath = path.join(dir, 'barrel.ts');
    fs.writeFileSync(filePath, "export * from '@modules/example-module';\n");

    const report = validateImportGuards({
      importGuards: [
        {
          id: 'no-domain-reexport',
          roots: [dir],
          bannedImportPatterns: ['^@modules/[^/]+'],
        },
      ],
      rootDir: process.cwd(),
      scanExtensions: ['.ts'],
    });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].guardId, 'no-domain-reexport');
    assert.equal(report.violations[0].specifier, '@modules/example-module');
  } finally {
    removeDir(dir);
  }
});
