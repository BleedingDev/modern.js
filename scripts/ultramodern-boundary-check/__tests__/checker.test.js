const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  checkForkImportBoundary,
  createAllowlistSnapshot,
  writeAllowlist,
} = require('../checker');

const repoRoot = path.resolve(__dirname, '../../..');

const runGit = (rootDir, args) =>
  execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();

const makeGitFixture = () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'modern-fork-boundary-'),
  );
  runGit(rootDir, ['init']);
  runGit(rootDir, ['config', 'user.email', 'fixture@example.test']);
  runGit(rootDir, ['config', 'user.name', 'Fixture']);

  const sourceDir = path.join(rootDir, 'packages/runtime/src');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, 'index.ts'),
    'export const runtimeValue = "upstream";\n',
  );

  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '-m', 'base']);

  return {
    baseRef: runGit(rootDir, ['rev-parse', 'HEAD']),
    rootDir,
  };
};

const writeFixtureAllowlist = ({ rootDir, baseRef, violations = [] }) => {
  const allowlistPath = path.join(rootDir, 'allowlist.json');
  fs.writeFileSync(
    allowlistPath,
    `${JSON.stringify(
      createAllowlistSnapshot({ baseRef, violations }),
      null,
      2,
    )}\n`,
  );
  return allowlistPath;
};

test('detects a new fork-only import in an upstream-owned source file', () => {
  const { rootDir, baseRef } = makeGitFixture();

  try {
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    fs.writeFileSync(
      path.join(rootDir, 'packages/runtime/src/index.ts'),
      [
        "import tanstackPlugin from '@modern-js/plugin-tanstack';",
        'export const runtimeValue = tanstackPlugin;',
        '',
      ].join('\n'),
    );

    const report = checkForkImportBoundary({
      rootDir,
      baseRef,
      allowlistPath,
    });

    assert.equal(report.ok, false);
    assert.equal(report.added.length, 1);
    assert.deepEqual(report.added[0], {
      file: 'packages/runtime/src/index.ts',
      markers: ['@modern-js/plugin-tanstack'],
      specifier: '@modern-js/plugin-tanstack',
    });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('ignores package source files that did not exist at the merge-base', () => {
  const { rootDir, baseRef } = makeGitFixture();

  try {
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    fs.writeFileSync(
      path.join(rootDir, 'packages/runtime/src/new-file.ts'),
      "import '@modern-js/plugin-tanstack';\n",
    );
    runGit(rootDir, ['add', '.']);

    const report = checkForkImportBoundary({
      rootDir,
      baseRef,
      allowlistPath,
    });

    assert.equal(report.ok, true);
    assert.equal(report.added.length, 0);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('writeAllowlist cannot permit existing governed imports', () => {
  const { rootDir, baseRef } = makeGitFixture();

  try {
    fs.writeFileSync(
      path.join(rootDir, 'packages/runtime/src/index.ts'),
      [
        "import { createRequest } from './create-request';",
        'export const runtimeValue = createRequest;',
        '',
      ].join('\n'),
    );

    const allowlistPath = path.join(rootDir, 'allowlist.json');
    const writeReport = writeAllowlist({ rootDir, baseRef, allowlistPath });
    const checkReport = checkForkImportBoundary({
      rootDir,
      baseRef,
      allowlistPath,
    });

    assert.equal(writeReport.violations.length, 1);
    assert.equal(checkReport.ok, false);
    assert.equal(checkReport.added.length, 0);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('an unresolvable ownership base fails closed instead of reporting clean', () => {
  const { rootDir, baseRef } = makeGitFixture();
  try {
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    assert.throws(
      () =>
        checkForkImportBoundary({
          rootDir,
          baseRef: 'missing-ref',
          allowlistPath,
        }),
      /ownership base.*does not resolve/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('inherited Git repository redirection cannot empty the import scan', () => {
  const { rootDir, baseRef } = makeGitFixture();
  const previous = process.env.GIT_DIR;
  try {
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    fs.writeFileSync(
      path.join(rootDir, 'packages/runtime/src/index.ts'),
      "import '@modern-js/plugin-tanstack';\n",
    );
    process.env.GIT_DIR = path.join(rootDir, 'missing-git-directory');
    assert.equal(
      checkForkImportBoundary({ rootDir, baseRef, allowlistPath })
        .currentViolations.length,
      1,
    );
  } finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('import verification CLI rejects caller-narrowed scope', () => {
  const cli = path.join(
    repoRoot,
    'scripts/ultramodern-boundary-check/check-fork-import-boundary.js',
  );
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [cli, '--mode', 'imports', '--pathspec', 'packages/runtime'],
        { cwd: repoRoot, stdio: 'pipe' },
      ),
    error => {
      assert.equal(error.status, 1);
      assert.match(
        error.stderr.toString(),
        /is not accepted in verification modes/,
      );
      return true;
    },
  );
});
