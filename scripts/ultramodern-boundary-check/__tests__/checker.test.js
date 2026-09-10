const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_ALLOWLIST_PATH,
  DEFAULT_BASE_REF,
  checkForkImportBoundary,
  createAllowlistSnapshot,
  findDenylistMatches,
  hasOnlyNativeRequestBindings,
  isNativeCreateRequestPackage,
  isNativeCreateRequestSurface,
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

const readNativeRequestSnapshot = ref => {
  const packagePath = 'packages/server/create-request';
  const read = file =>
    ref
      ? runGit(repoRoot, ['show', `${ref}:${packagePath}/${file}`])
      : fs.readFileSync(path.join(repoRoot, packagePath, file), 'utf8');
  const files = ref
    ? runGit(repoRoot, [
        'ls-tree',
        '-r',
        '--name-only',
        ref,
        '--',
        `${packagePath}/src`,
      ])
        .split('\n')
        .map(file => file.slice(`${packagePath}/src/`.length))
    : fs.readdirSync(path.join(repoRoot, packagePath, 'src'));
  return {
    manifest: JSON.parse(read('package.json')),
    sources: Object.fromEntries(files.map(file => [file, read(`src/${file}`)])),
  };
};

const nativeRequestSnapshot = readNativeRequestSnapshot();

const makeNativeRequestFixture = () => {
  const fixture = makeGitFixture();
  const packageDir = path.join(
    fixture.rootDir,
    'packages/server/create-request',
  );
  fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(nativeRequestSnapshot.manifest),
  );
  for (const [file, source] of Object.entries(nativeRequestSnapshot.sources)) {
    fs.writeFileSync(path.join(packageDir, 'src', file), source);
  }
  fs.writeFileSync(
    path.join(fixture.rootDir, 'packages/runtime/src/index.ts'),
    "export { configure, createRequest, createUploader } from '@modern-js/create-request';\n",
  );
  runGit(fixture.rootDir, ['add', '.']);
  runGit(fixture.rootDir, ['commit', '-m', 'native request package']);
  return {
    ...fixture,
    baseRef: runGit(fixture.rootDir, ['rev-parse', 'HEAD']),
    packageDir,
  };
};

test('native request retirement contract accepts the reviewed working-tree surface', () => {
  assert.equal(isNativeCreateRequestSurface(nativeRequestSnapshot), true);
});

for (const ref of [
  'eded841256a7cffdaa622e3889fc83407debd3e4',
  '2f4d9c4559e26209a0d77f02c6757f29fe3699a2',
  DEFAULT_BASE_REF,
]) {
  test(`native request package and native trio already exist at ${ref}`, () => {
    assert.equal(
      isNativeCreateRequestSurface(readNativeRequestSnapshot(ref)),
      true,
    );
    assert.equal(
      isNativeCreateRequestPackage({
        rootDir: repoRoot,
        baseRef: ref,
        headRef: ref,
      }),
      true,
    );
    assert.equal(
      hasOnlyNativeRequestBindings(
        runGit(repoRoot, [
          'show',
          `${ref}:packages/cli/plugin-bff/src/runtime/create-request/index.ts`,
        ]),
      ),
      true,
    );
  });
}

for (const [name, mutate] of [
  [
    'restored policy module',
    snapshot => {
      snapshot.sources['policyCore.ts'] = 'export const test = 1;';
    },
  ],
  [
    'unknown renamed policy module',
    snapshot => {
      snapshot.sources['renamed-policy.ts'] = 'export const test = 1;';
    },
  ],
  [
    'restored policy option',
    snapshot => {
      snapshot.sources['types.ts'] +=
        '\nexport type IOptionsExtra = { requireEnvelope: boolean };';
    },
  ],
  [
    'restored inline policy',
    snapshot => {
      snapshot.sources['requestFactory.ts'] +=
        '\nconst requireEnvelope = true;';
    },
  ],
  [
    'quoted policy property',
    snapshot => {
      snapshot.sources['requestFactory.ts'] +=
        '\nconst options = { "requireEnvelope": true };';
    },
  ],
  [
    'computed policy property',
    snapshot => {
      snapshot.sources['requestFactory.ts'] +=
        '\nconst value = options["operationContract"];';
    },
  ],
  [
    'escaped policy identifier',
    snapshot => {
      snapshot.sources['types.ts'] +=
        '\nexport type Operatio\\u006eContext = {};';
    },
  ],
  [
    'fork package import',
    snapshot => {
      snapshot.sources['node.ts'] +=
        "\nimport '@modern-js/runtime-extensions/request-policy/node';";
    },
  ],
  [
    'fork export subpath',
    snapshot => {
      snapshot.manifest.exports['./policy'] = {
        default: './dist/esm/policy.mjs',
      };
    },
  ],
  [
    'fork export redirection',
    snapshot => {
      snapshot.manifest.exports['.'].default =
        '@modern-js/runtime-extensions/request-policy/node';
    },
  ],
  [
    'fork runtime dependency',
    snapshot => {
      snapshot.manifest.dependencies['@modern-js/runtime-extensions'] =
        'workspace:*';
    },
  ],
  [
    'additional typed subpath',
    snapshot => {
      snapshot.manifest.typesVersions['*'].policy = [
        './dist/types/browser.d.ts',
      ];
    },
  ],
  [
    'dependency alias redirection',
    snapshot => {
      snapshot.manifest.dependencies.qs =
        'npm:@modern-js/runtime-extensions@1.0.0';
    },
  ],
  [
    'wildcard policy export',
    snapshot => {
      snapshot.sources['node.ts'] += "\nexport * from './policyCore';";
    },
  ],
  [
    'unexpected public binding',
    snapshot => {
      snapshot.sources['browser.ts'] += '\nexport const policy = {};';
    },
  ],
  [
    'unexpected exported alias',
    snapshot => {
      snapshot.sources['browser.ts'] +=
        '\nexport { createClient as hiddenPolicy };';
    },
  ],
  [
    'types runtime export',
    snapshot => {
      snapshot.sources['types.ts'] += '\nexport const policy = {};';
    },
  ],
  [
    'missing native entry',
    snapshot => {
      delete snapshot.sources['node.ts'];
    },
  ],
  [
    'relative import escape',
    snapshot => {
      snapshot.sources['node.ts'] +=
        "\nexport { createRequest } from '../../runtime-extensions/request-policy';";
    },
  ],
  [
    'nonliteral dependency',
    snapshot => {
      snapshot.sources['node.ts'] +=
        '\nconst extension = require(extensionPath);';
    },
  ],
  [
    'invalid source syntax',
    snapshot => {
      snapshot.sources['node.ts'] += '\nexport {{{';
    },
  ],
  [
    'null export target',
    snapshot => {
      snapshot.manifest.exports['.'].default = null;
    },
  ],
]) {
  test(`native request retirement contract rejects ${name}`, () => {
    const snapshot = structuredClone(nativeRequestSnapshot);
    mutate(snapshot);
    assert.equal(isNativeCreateRequestSurface(snapshot), false);
  });
}

test('native request policy inspection ignores comments and unrelated string values', () => {
  const snapshot = structuredClone(nativeRequestSnapshot);
  snapshot.sources['requestFactory.ts'] += `
// requireEnvelope OperationContext import '@modern-js/runtime-extensions';
const diagnostic = "identityBinding OperationContext";
`;
  assert.equal(isNativeCreateRequestSurface(snapshot), true);
});

for (const source of [
  "export { configure, createRequest, createUploader } from '@modern-js/create-request';",
  "import { configure as nativeConfigure } from '@modern-js/create-request';",
  "export { configure as publicConfigure } from '@modern-js/create-request';",
  "import type { configure as Configure } from '@modern-js/create-request';",
  "export type { configure as Configure } from '@modern-js/create-request';",
  "import { type configure, createRequest } from '@modern-js/create-request';",
]) {
  test(`native request eligibility follows the source binding: ${source}`, () => {
    assert.equal(hasOnlyNativeRequestBindings(source), true);
  });
}

for (const source of [
  "export * from '@modern-js/create-request';",
  "import * as requests from '@modern-js/create-request';",
  "export * as requests from '@modern-js/create-request';",
  "import configure from '@modern-js/create-request';",
  "const requests = require('@modern-js/create-request');",
  "import('@modern-js/create-request');",
  "import '@modern-js/create-request';",
  "export { configure, OperationContext } from '@modern-js/create-request';",
  "export { OperationContext as configure } from '@modern-js/create-request';",
  "import type { OperationContext as configure } from '@modern-js/create-request';",
  "export { createClient } from '@modern-js/create-request';",
  "export { createRequest } from '@modern-js/create-request/policy';",
  "export { createRequest } from './create-request';",
  "export { createRequest } from '@modern-js/create-request-policy';",
  "export { configure } from '@modern-js/create-request'; const requests = require('@modern-js/create-request');",
  "// export { configure } from '@modern-js/create-request';\nimport * as requests from '@modern-js/create-request';",
  'const fake = "export { configure } from \'@modern-js/create-request\'";',
]) {
  test(`native request eligibility rejects non-native or opaque bindings: ${source}`, () => {
    assert.equal(hasOnlyNativeRequestBindings(source), false);
  });
}

test('native request eligibility uses target bytes and includes untracked retirement regressions', () => {
  const { rootDir, baseRef, packageDir } = makeNativeRequestFixture();
  try {
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    const check = headRef =>
      checkForkImportBoundary({ rootDir, baseRef, headRef, allowlistPath });
    assert.equal(check().ok, true);
    assert.equal(check(baseRef).ok, true);
    const policy = path.join(packageDir, 'src/policyCore.ts');
    fs.writeFileSync(policy, 'export const restored = true;\n');
    assert.equal(
      check().ok,
      false,
      'untracked policy source must revoke eligibility',
    );
    assert.equal(
      check(baseRef).ok,
      true,
      'committed native target ignores working-tree policy',
    );
    runGit(rootDir, ['add', '.']);
    runGit(rootDir, ['commit', '-m', 'restored policy']);
    const mixedHead = runGit(rootDir, ['rev-parse', 'HEAD']);
    fs.unlinkSync(policy);
    assert.equal(
      check().ok,
      true,
      'working-tree retirement is measured independently',
    );
    assert.equal(
      check(mixedHead).ok,
      false,
      'committed policy cannot borrow worktree retirement',
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('native request eligibility does not weaken any broader or custom marker', () => {
  assert.deepEqual(
    findDenylistMatches({ specifier: '@modern-js/create-request' }),
    ['create-request'],
  );
  const { rootDir, baseRef } = makeNativeRequestFixture();
  try {
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    const file = path.join(rootDir, 'packages/runtime/src/index.ts');
    for (const specifier of [
      './create-request',
      '@modern-js/create-request/policy',
      '@modern-js/create-request-policy',
      '@modern-js/runtime-extensions/request-policy',
      '@modern-js/runtime-utils/backend-federation',
    ]) {
      fs.writeFileSync(file, `export { configure } from '${specifier}';\n`);
      const report = checkForkImportBoundary({
        rootDir,
        baseRef,
        allowlistPath,
      });
      assert.equal(report.ok, false, specifier);
      assert.equal(report.currentViolations.length, 1, specifier);
    }
    fs.writeFileSync(
      file,
      "export { configure } from '@modern-js/create-request';\n",
    );
    const report = checkForkImportBoundary({
      rootDir,
      baseRef,
      allowlistPath,
      denylist: ['create-request', '@modern-js/create-request'],
    });
    assert.equal(report.ok, false);
    assert.deepEqual(report.currentViolations[0].markers, [
      '@modern-js/create-request',
    ]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

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

for (const source of [
  "export * from '@modern-js/plugin-tanstack';\n",
  "import type { Plugin } from '@modern-js/plugin-tanstack';\n",
  "const load = () => import('@modern-js/plugin-tanstack');\n",
  "const plugin = require('@modern-js/plugin-tanstack');\n",
]) {
  test(`strict check rejects allowlisted import syntax: ${source.trim()}`, () => {
    const { rootDir, baseRef } = makeGitFixture();
    try {
      const file = 'packages/runtime/src/index.ts';
      fs.writeFileSync(path.join(rootDir, file), source);
      const allowlistPath = writeFixtureAllowlist({
        rootDir,
        baseRef,
        violations: [{ file, specifier: '@modern-js/plugin-tanstack' }],
      });
      const report = checkForkImportBoundary({
        rootDir,
        baseRef,
        allowlistPath,
      });
      assert.equal(report.added.length, 0);
      assert.equal(report.currentViolations.length, 1);
      assert.equal(report.ok, false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
}

test('committed head scans its tree regardless of worktree contents or deletions', () => {
  const { rootDir, baseRef } = makeGitFixture();
  try {
    const file = path.join(rootDir, 'packages/runtime/src/index.ts');
    const allowlistPath = writeFixtureAllowlist({ rootDir, baseRef });
    fs.writeFileSync(file, "import '@modern-js/plugin-tanstack';\n");
    runGit(rootDir, ['add', '.']);
    runGit(rootDir, ['commit', '-m', 'fork import']);
    const headRef = runGit(rootDir, ['rev-parse', 'HEAD']);
    fs.unlinkSync(file);
    const report = checkForkImportBoundary({
      rootDir,
      baseRef,
      headRef,
      allowlistPath,
    });
    assert.equal(report.ok, false);
    assert.equal(report.headRef, headRef);
    assert.equal(report.currentViolations.length, 1);
    assert.equal(
      checkForkImportBoundary({
        rootDir,
        baseRef,
        headRef: baseRef,
        allowlistPath,
      }).ok,
      true,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('missing refs and unrelated ownership bases fail closed', () => {
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
    assert.throws(
      () =>
        checkForkImportBoundary({
          rootDir,
          baseRef,
          headRef: 'missing-ref',
          allowlistPath,
        }),
      /target.*does not resolve/,
    );
    runGit(rootDir, ['checkout', '--orphan', 'unrelated']);
    runGit(rootDir, ['commit', '-m', 'unrelated base']);
    const unrelated = runGit(rootDir, ['rev-parse', 'HEAD']);
    assert.throws(
      () =>
        checkForkImportBoundary({
          rootDir,
          baseRef,
          headRef: unrelated,
          allowlistPath,
        }),
      /is-ancestor.*failed/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('allowlist base cannot substitute a different ownership tree', () => {
  const { rootDir, baseRef } = makeGitFixture();
  try {
    const allowlistPath = writeFixtureAllowlist({
      rootDir,
      baseRef: 'missing-ref',
    });
    assert.throws(
      () => checkForkImportBoundary({ rootDir, baseRef, allowlistPath }),
      /ownership base does not match/,
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

test('import verification CLI rejects scope and ownership overrides', () => {
  const cli = path.join(
    repoRoot,
    'scripts/ultramodern-boundary-check/check-fork-import-boundary.js',
  );
  for (const [flag, value] of [
    ['--root', repoRoot],
    ['--base-ref', 'HEAD'],
    ['--allowlist', DEFAULT_ALLOWLIST_PATH],
    ['--pathspec', 'packages/runtime'],
    ['--base', 'HEAD'],
    ['--divergence-allowlist', DEFAULT_ALLOWLIST_PATH],
  ]) {
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [cli, '--mode', 'imports', flag, value],
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
  }
});
