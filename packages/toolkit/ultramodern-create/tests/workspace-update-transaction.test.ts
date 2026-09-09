import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  __transactionTestHooks,
  recoverFreshWorkspaceTransactions,
  recoverWorkspaceTransactions,
  runFreshWorkspaceTransaction,
  runWorkspaceTransaction,
  WorkspaceTransactionConflictError,
} from '../src/ultramodern-workspace/add-vertical/transaction';

function fixture() {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-update-transaction-'),
  );
  const root = path.join(parent, 'workspace');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'owned.json'), 'before');
  fs.chmodSync(path.join(root, 'owned.json'), 0o640);
  return {
    parent,
    root,
    fileMode: fs.statSync(path.join(root, 'owned.json')).mode & 0o777,
    clean: () => {
      for (const key of Object.keys(__transactionTestHooks))
        delete __transactionTestHooks[
          key as keyof typeof __transactionTestHooks
        ];
      fs.rmSync(parent, { recursive: true, force: true });
    },
  };
}

test('async mutation and validation finish before any live publication', async () => {
  const f = fixture();
  try {
    const pending = runWorkspaceTransaction(f.root, async stage => {
      fs.writeFileSync(path.join(stage, 'owned.json'), 'after');
      await Promise.resolve();
      assert.equal(
        fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
        'before',
      );
      assert.ok(fs.existsSync(stage));
      return 0;
    });
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'before',
    );
    assert.equal(await pending, 0);
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'after',
    );
    assert.equal(
      fs.statSync(path.join(f.root, 'owned.json')).mode & 0o777,
      f.fileMode,
    );
    assert.deepEqual(fs.readdirSync(f.parent), ['workspace']);
  } finally {
    f.clean();
  }
});

test('async rejection and failed commit predicate discard the prepared tree', async () => {
  const f = fixture();
  try {
    await assert.rejects(
      runWorkspaceTransaction(f.root, async stage => {
        fs.writeFileSync(path.join(stage, 'owned.json'), 'after');
        await Promise.resolve();
        throw new Error('target validation failed');
      }),
      /target validation failed/,
    );
    assert.equal(
      await runWorkspaceTransaction(
        f.root,
        async stage => {
          fs.writeFileSync(path.join(stage, 'owned.json'), 'after');
          return 23;
        },
        { commitWhen: status => status === 0 },
      ),
      23,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'before',
    );
    assert.deepEqual(fs.readdirSync(f.parent), ['workspace']);
  } finally {
    f.clean();
  }
});

test('stage writes through internal links preserve live link text and target isolation', async () => {
  const f = fixture();
  try {
    fs.symlinkSync(
      path.join(f.root, 'owned.json'),
      path.join(f.root, 'absolute.json'),
    );
    fs.symlinkSync('owned.json', path.join(f.root, 'relative.json'));
    await runWorkspaceTransaction(f.root, async stage => {
      fs.writeFileSync(path.join(stage, 'absolute.json'), 'after');
      await Promise.resolve();
      assert.equal(
        fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
        'before',
      );
      assert.equal(
        fs.readFileSync(path.join(stage, 'relative.json'), 'utf8'),
        'after',
      );
    });
    assert.equal(
      fs.readlinkSync(path.join(f.root, 'absolute.json')),
      path.join(f.root, 'owned.json'),
    );
    assert.equal(
      fs.readlinkSync(path.join(f.root, 'relative.json')),
      'owned.json',
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'after',
    );
  } finally {
    f.clean();
  }
});

test('async concurrent consumer change conflicts without overwriting it', async () => {
  const f = fixture();
  try {
    await assert.rejects(
      runWorkspaceTransaction(f.root, async stage => {
        fs.writeFileSync(path.join(stage, 'owned.json'), 'after');
        await Promise.resolve();
        fs.writeFileSync(path.join(f.root, 'owned.json'), 'consumer');
      }),
      WorkspaceTransactionConflictError,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'consumer',
    );
  } finally {
    f.clean();
  }
});

test('external links fail before the mutation callback can reach them', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.parent, 'external'), 'private');
    fs.symlinkSync('../external', path.join(f.root, 'link'));
    let called = false;
    assert.throws(
      () =>
        runWorkspaceTransaction(f.root, () => {
          called = true;
        }),
      /link escapes/,
    );
    assert.equal(called, false);
    assert.equal(
      fs.readFileSync(path.join(f.parent, 'external'), 'utf8'),
      'private',
    );
  } finally {
    f.clean();
  }
});

function crashDuringPublication(root: string) {
  const transactionUrl = pathToFileURL(
    path.resolve(
      __dirname,
      '../src/ultramodern-workspace/add-vertical/transaction.ts',
    ),
  ).href;
  const loaderUrl = pathToFileURL(
    fs.realpathSync(
      path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
    ),
  ).href;
  return spawnSync(
    process.execPath,
    [
      '--import',
      loaderUrl,
      '--input-type=module',
      '--eval',
      `
    import fs from 'node:fs';
    import path from 'node:path';
    import { runWorkspaceTransaction, __transactionTestHooks } from ${JSON.stringify(transactionUrl)};
    __transactionTestHooks.afterPublishPath = () => process.kill(process.pid, 'SIGKILL');
    runWorkspaceTransaction(process.cwd(), stage => {
      fs.writeFileSync(path.join(stage, 'owned.json'), 'after');
      fs.writeFileSync(path.join(stage, 'second.json'), 'after second');
    });
  `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
}

function crashDuringFreshPublication(root: string, phase = 'file') {
  const transactionUrl = pathToFileURL(
    path.resolve(
      __dirname,
      '../src/ultramodern-workspace/add-vertical/transaction.ts',
    ),
  ).href;
  const loaderUrl = pathToFileURL(
    fs.realpathSync(
      path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
    ),
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      loaderUrl,
      '--input-type=module',
      '--eval',
      `
    import fs from 'node:fs';
    import path from 'node:path';
    import { runFreshWorkspaceTransaction, __transactionTestHooks } from ${JSON.stringify(transactionUrl)};
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const phase = ${JSON.stringify(phase)};
    const rename = fs.renameSync;
    fs.renameSync = (source, target) => {
      rename(source, target);
      if (phase === 'directory' && path.basename(source).startsWith('.ultramodern-directory-')) process.kill(process.pid, 'SIGKILL');
      if (phase === 'committed' && target.endsWith('.receipt.json') && JSON.parse(fs.readFileSync(target, 'utf8')).state === 'committed') process.kill(process.pid, 'SIGKILL');
    };
    __transactionTestHooks.afterPublishPath = () => {
      if (phase === 'file') process.kill(process.pid, 'SIGKILL');
    };
    runFreshWorkspaceTransaction(process.cwd(), stage => {
      fs.mkdirSync(path.join(stage, 'nested/deeper'), { recursive: true });
      fs.writeFileSync(path.join(stage, 'nested/deeper/first.txt'), 'first');
      fs.writeFileSync(path.join(stage, 'nested/second.txt'), 'second');
    });
  `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(
    result.status,
    process.platform === 'win32' ? 1 : null,
    result.stderr,
  );
  assert.equal(
    result.signal,
    process.platform === 'win32' ? null : 'SIGKILL',
    result.stderr,
  );
}

test('fresh retry recovers nested files and directory ownership after hard interruption', () => {
  for (const phase of ['directory', 'file']) {
    const f = fixture();
    try {
      fs.unlinkSync(path.join(f.root, 'owned.json'));
      const identity = fs.statSync(f.root);
      crashDuringFreshPublication(f.root, phase);
      recoverWorkspaceTransactions(f.root);
      assert.ok(
        fs.readdirSync(f.parent).some(entry => entry.endsWith('.receipt.json')),
        'updater recovery must not consume fresh receipts',
      );
      runFreshWorkspaceTransaction(f.root, stage => {
        assert.equal(fs.statSync(f.root).ino, identity.ino);
        assert.deepEqual(
          fs.readdirSync(f.root),
          [],
          'fresh recovery restores the exact empty target before generation',
        );
        fs.mkdirSync(path.join(stage, 'retry'));
        fs.writeFileSync(path.join(stage, 'retry/success.txt'), 'success');
      });
      assert.equal(
        fs.readFileSync(path.join(f.root, 'retry/success.txt'), 'utf8'),
        'success',
      );
      assert.deepEqual(fs.readdirSync(f.parent), ['workspace']);
    } finally {
      f.clean();
    }
  }
});

test('fresh recovery preserves foreign bytes, replaced directories, and live-owner receipts', () => {
  for (const conflict of ['bytes', 'extra', 'directory', 'live']) {
    const f = fixture();
    try {
      fs.unlinkSync(path.join(f.root, 'owned.json'));
      crashDuringFreshPublication(f.root);
      const receiptPath = path.join(
        f.parent,
        fs
          .readdirSync(f.parent)
          .find(entry => entry.endsWith('.receipt.json'))!,
      );
      if (conflict === 'bytes')
        fs.writeFileSync(
          path.join(f.root, 'nested/deeper/first.txt'),
          'consumer',
        );
      if (conflict === 'extra')
        fs.writeFileSync(path.join(f.root, 'consumer.txt'), 'consumer');
      if (conflict === 'directory') {
        fs.renameSync(
          path.join(f.root, 'nested'),
          path.join(f.parent, 'preserved-nested'),
        );
        fs.mkdirSync(path.join(f.root, 'nested'));
      }
      if (conflict === 'live') {
        const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
        receipt.pid = process.pid;
        fs.writeFileSync(receiptPath, JSON.stringify(receipt));
      }
      const snapshot = () =>
        fs
          .readdirSync(f.parent, { recursive: true, withFileTypes: true })
          .filter(entry => entry.isFile())
          .map(entry => {
            const filePath = path.join(entry.parentPath, entry.name);
            return [filePath, fs.readFileSync(filePath).toString('base64')];
          })
          .sort();
      const before = snapshot();
      if (conflict === 'live') {
        // Rstest guards calls targeting its own process. Exercise native
        // signal-zero ownership probing from a separate Node process.
        const result = spawnSync(
          process.execPath,
          [
            '--import',
            pathToFileURL(
              fs.realpathSync(
                path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
              ),
            ).href,
            '--input-type=module',
            '--eval',
            `
            import assert from 'node:assert/strict';
            import { recoverFreshWorkspaceTransactions } from ${JSON.stringify(pathToFileURL(path.resolve(__dirname, '../src/ultramodern-workspace/add-vertical/transaction.ts')).href)};
            assert.throws(() => recoverFreshWorkspaceTransactions(process.cwd()), /still owned/);
          `,
          ],
          { cwd: f.root, encoding: 'utf8' },
        );
        assert.equal(result.status, 0, result.stderr);
      } else {
        assert.throws(
          () =>
            runFreshWorkspaceTransaction(f.root, () =>
              assert.fail('must not regenerate a conflicted target'),
            ),
          /newer consumer|directory changed/,
        );
      }
      assert.deepEqual(snapshot(), before);
      assert.ok(fs.existsSync(receiptPath));
    } finally {
      f.clean();
    }
  }
});

test('fresh recovery leaves committed output and ignores updater receipts', () => {
  const f = fixture();
  try {
    crashDuringPublication(f.root);
    recoverFreshWorkspaceTransactions(f.root);
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'after',
    );
    assert.ok(
      fs.readdirSync(f.parent).some(entry => entry.endsWith('.receipt.json')),
    );
    recoverWorkspaceTransactions(f.root);
    fs.unlinkSync(path.join(f.root, 'owned.json'));
    crashDuringFreshPublication(f.root, 'committed');
    const preserved = path.join(f.parent, 'preserved-committed');
    fs.renameSync(path.join(f.root, 'nested'), preserved);
    fs.mkdirSync(path.join(f.root, 'nested'));
    assert.throws(
      () => recoverFreshWorkspaceTransactions(f.root),
      /directory changed/,
    );
    assert.ok(
      fs.readdirSync(f.parent).some(entry => entry.endsWith('.receipt.json')),
    );
    fs.rmdirSync(path.join(f.root, 'nested'));
    fs.renameSync(preserved, path.join(f.root, 'nested'));
    fs.writeFileSync(
      path.join(f.root, 'consumer.txt'),
      'consumer after commit',
    );
    assert.throws(
      () =>
        runFreshWorkspaceTransaction(f.root, () =>
          assert.fail('completed output must not be replaced'),
        ),
      /Refusing to replace/,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'nested/deeper/first.txt'), 'utf8'),
      'first',
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'nested/second.txt'), 'utf8'),
      'second',
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'consumer.txt'), 'utf8'),
      'consumer after commit',
    );
    assert.deepEqual(fs.readdirSync(f.parent), ['workspace']);
  } finally {
    f.clean();
  }
});

test('fresh nested-directory conflicts preserve external bytes and never reclaim through replaced ancestors', () => {
  for (const timing of [
    'after-parent',
    'between-directories',
    'during-rename',
    'during-rename-foreign',
  ]) {
    const f = fixture();
    try {
      fs.unlinkSync(path.join(f.root, 'owned.json'));
      const transactionUrl = pathToFileURL(
        path.resolve(
          __dirname,
          '../src/ultramodern-workspace/add-vertical/transaction.ts',
        ),
      ).href;
      const loaderUrl = pathToFileURL(
        fs.realpathSync(
          path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
        ),
      ).href;
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          loaderUrl,
          '--input-type=module',
          '--eval',
          `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        import path from 'node:path';
        import { runFreshWorkspaceTransaction } from ${JSON.stringify(transactionUrl)};
        const root = process.cwd();
        const parent = path.dirname(root);
        const outside = path.join(parent, 'outside');
        const preserved = path.join(parent, 'preserved-parent');
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'consumer.txt'), 'untouched');
        const nativePlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const rename = fs.renameSync;
        const lstat = fs.lstatSync;
        let replaced = false;
        let parentMoved = false;
        let nestedRenameAttempted = false;
        let externalRenameAttempted = false;
        const replace = () => {
          replaced = true;
          rename(path.join(root, 'a'), preserved);
          fs.symlinkSync(outside, path.join(root, 'a'), nativePlatform === 'win32' ? 'junction' : 'dir');
        };
        fs.renameSync = (source, target) => {
          if (source.startsWith(outside + path.sep)) externalRenameAttempted = true;
          const publication = path.basename(source).startsWith('.ultramodern-directory-');
          if (publication && target === path.join(root, 'a/b')) nestedRenameAttempted = true;
          if (${JSON.stringify(timing)}.startsWith('during-rename') && publication && target === path.join(root, 'a/b')) replace();
          rename(source, target);
          if (${JSON.stringify(timing)} === 'during-rename-foreign' && publication && target === path.join(root, 'a/b')) {
            rename(path.join(outside, 'b'), path.join(outside, 'owned-b'));
            fs.mkdirSync(path.join(outside, 'b'));
            fs.writeFileSync(path.join(outside, 'b/consumer.txt'), 'foreign data stays here');
          }
          if (publication && target === path.join(root, 'a')) parentMoved = true;
          if (${JSON.stringify(timing)} === 'after-parent' && publication && target === path.join(root, 'a')) replace();
        };
        fs.lstatSync = (candidate, ...options) => {
          const stat = lstat(candidate, ...options);
          if (${JSON.stringify(timing)} === 'between-directories' && parentMoved && !replaced && candidate === path.join(root, 'a')) replace();
          return stat;
        };
        assert.throws(() => runFreshWorkspaceTransaction(root, stage => {
          fs.mkdirSync(path.join(stage, 'a/b'), { recursive: true });
          fs.writeFileSync(path.join(stage, 'a/b/file.txt'), 'generated');
        }), /transaction|parent changed/);
        assert.equal(replaced, true);
        assert.equal(nestedRenameAttempted, ${JSON.stringify(timing)}.startsWith('during-rename'));
        assert.equal(externalRenameAttempted, false);
        const expectedOutside = ${JSON.stringify(timing)} === 'during-rename-foreign' ? ['b', 'consumer.txt', 'owned-b'] : ${JSON.stringify(timing)} === 'during-rename' ? ['b', 'consumer.txt'] : ['consumer.txt'];
        assert.deepEqual(fs.readdirSync(outside).sort(), expectedOutside);
        if (${JSON.stringify(timing)} === 'during-rename') assert.deepEqual(fs.readdirSync(path.join(outside, 'b')), []);
        if (${JSON.stringify(timing)} === 'during-rename-foreign') {
          assert.equal(fs.readFileSync(path.join(outside, 'b/consumer.txt'), 'utf8'), 'foreign data stays here');
          assert.deepEqual(fs.readdirSync(path.join(outside, 'owned-b')), []);
        }
        assert.equal(fs.readFileSync(path.join(outside, 'consumer.txt'), 'utf8'), 'untouched');
        assert.deepEqual(fs.readdirSync(preserved), []);
        assert.ok(fs.lstatSync(path.join(root, 'a')).isSymbolicLink());
        assert.ok(fs.readdirSync(parent).some(entry => entry.endsWith('.receipt.json')));
      `,
        ],
        { cwd: f.root, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
    } finally {
      f.clean();
    }
  }
});

test('hard interruption during promotion recovers exact preimages before retry', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root, 'second.json'), 'before second');
    const crashed = crashDuringPublication(f.root);
    assert.equal(
      crashed.status,
      process.platform === 'win32' ? 1 : null,
      crashed.stderr,
    );
    assert.equal(
      crashed.signal,
      process.platform === 'win32' ? null : 'SIGKILL',
      crashed.stderr,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'after',
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'second.json'), 'utf8'),
      'before second',
    );
    recoverWorkspaceTransactions(f.root);
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'before',
    );
    assert.equal(
      fs.statSync(path.join(f.root, 'owned.json')).mode & 0o777,
      f.fileMode,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'second.json'), 'utf8'),
      'before second',
    );
    assert.deepEqual(fs.readdirSync(f.parent), ['workspace']);
    assert.deepEqual(fs.readdirSync(f.root), ['owned.json', 'second.json']);
    runWorkspaceTransaction(f.root, stage =>
      fs.writeFileSync(path.join(stage, 'owned.json'), 'retry'),
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'retry',
    );
  } finally {
    f.clean();
  }
});

test('interrupted recovery preserves later consumer edits and durable preimages', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root, 'second.json'), 'before second');
    const crashed = crashDuringPublication(f.root);
    assert.equal(
      crashed.status,
      process.platform === 'win32' ? 1 : null,
      crashed.stderr,
    );
    assert.equal(
      crashed.signal,
      process.platform === 'win32' ? null : 'SIGKILL',
      crashed.stderr,
    );
    fs.writeFileSync(path.join(f.root, 'owned.json'), 'consumer after crash');
    assert.throws(
      () => recoverWorkspaceTransactions(f.root),
      /newer consumer bytes/,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'consumer after crash',
    );
    assert.ok(
      fs.readdirSync(f.parent).some(entry => entry.endsWith('.receipt.json')),
    );
    assert.ok(
      fs
        .readdirSync(f.root)
        .some(entry => entry.includes('.ultramodern-rollback-')),
    );
  } finally {
    f.clean();
  }
});

test('Windows receipt publication flushes files without attempting unsupported directory fsync', () => {
  const f = fixture();
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const fsync = fs.fsyncSync;
  let fileFlushes = 0;
  try {
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    fs.fsyncSync = fd => {
      assert.equal(
        fs.fstatSync(fd).isDirectory(),
        false,
        'Windows must not request directory fsync',
      );
      fileFlushes++;
      fsync(fd);
    };
    runWorkspaceTransaction(f.root, stage =>
      fs.writeFileSync(path.join(stage, 'owned.json'), 'after'),
    );
    assert.equal(
      fileFlushes,
      2,
      'both publishing and committed receipts must flush their bytes',
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'after',
    );
    assert.deepEqual(fs.readdirSync(f.parent), ['workspace']);
  } finally {
    fs.fsyncSync = fsync;
    Object.defineProperty(process, 'platform', platform);
    f.clean();
  }
});

test('Windows receipt file permission failures still abort before publication', () => {
  const f = fixture();
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const fsync = fs.fsyncSync;
  const permission = Object.assign(new Error('file flush denied'), {
    code: 'EPERM',
  });
  try {
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    fs.fsyncSync = fd => {
      assert.equal(fs.fstatSync(fd).isFile(), true);
      throw permission;
    };
    assert.throws(
      () =>
        runWorkspaceTransaction(f.root, stage =>
          fs.writeFileSync(path.join(stage, 'owned.json'), 'after'),
        ),
      error => error === permission,
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'before',
    );
  } finally {
    fs.fsyncSync = fsync;
    Object.defineProperty(process, 'platform', platform);
    f.clean();
  }
});

test('POSIX receipt directory flush errors propagate without promoting consumer files', () => {
  const f = fixture();
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const fsync = fs.fsyncSync;
  const permission = Object.assign(new Error('directory flush denied'), {
    code: 'EPERM',
  });
  let fileFlushes = 0;
  try {
    Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
    fs.fsyncSync = fd => {
      if (fs.fstatSync(fd).isDirectory()) throw permission;
      fileFlushes++;
      fsync(fd);
    };
    assert.throws(
      () =>
        runWorkspaceTransaction(f.root, stage =>
          fs.writeFileSync(path.join(stage, 'owned.json'), 'after'),
        ),
      error => error === permission,
    );
    assert.equal(fileFlushes, 1);
    assert.equal(
      fs.readFileSync(path.join(f.root, 'owned.json'), 'utf8'),
      'before',
    );
  } finally {
    fs.fsyncSync = fsync;
    Object.defineProperty(process, 'platform', platform);
    f.clean();
  }
});

test('publication includes dist and coverage packages while excluding their generated output', () => {
  const f = fixture();
  try {
    for (const name of ['dist', 'coverage']) {
      const packageDir = path.join(f.root, 'verticals', name);
      fs.mkdirSync(path.join(packageDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'package.json'), 'before package');
      fs.writeFileSync(
        path.join(packageDir, 'dist/output.js'),
        'consumer output',
      );
    }
    runWorkspaceTransaction(f.root, stage => {
      for (const name of ['dist', 'coverage']) {
        const packageDir = path.join(stage, 'verticals', name);
        assert.equal(
          fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
          'before package',
        );
        assert.equal(fs.existsSync(path.join(packageDir, 'dist')), false);
        fs.writeFileSync(
          path.join(packageDir, 'package.json'),
          'after package',
        );
      }
    });
    for (const name of ['dist', 'coverage']) {
      assert.equal(
        fs.readFileSync(
          path.join(f.root, 'verticals', name, 'package.json'),
          'utf8',
        ),
        'after package',
      );
      assert.equal(
        fs.readFileSync(
          path.join(f.root, 'verticals', name, 'dist/output.js'),
          'utf8',
        ),
        'consumer output',
      );
    }
  } finally {
    f.clean();
  }
});

test('Windows empty-cwd publication preserves the held directory inode and rolls back a partial failure', () => {
  const f = fixture();
  const transactionUrl = pathToFileURL(
    path.resolve(
      __dirname,
      '../src/ultramodern-workspace/add-vertical/transaction.ts',
    ),
  ).href;
  const loaderUrl = pathToFileURL(
    fs.realpathSync(
      path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs'),
    ),
  ).href;
  try {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        loaderUrl,
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import path from 'node:path';
      import { runFreshWorkspaceTransaction, __transactionTestHooks } from ${JSON.stringify(transactionUrl)};
      const parent = process.cwd();
      Object.defineProperty(process, 'platform', { value: 'win32' });
      for (const fail of [false, true]) {
        const root = path.join(parent, fail ? 'failed' : 'success');
        fs.mkdirSync(root);
        process.chdir(root);
        const canonical = process.cwd();
        const identity = fs.statSync('.');
        const rename = fs.renameSync;
        const chdir = process.chdir;
        fs.renameSync = (source, target) => {
          assert.notEqual(source, root, 'the launching shell may retain a cwd handle; never rename the root');
          return rename(source, target);
        };
        process.chdir = () => { throw new Error('publisher must not mutate global cwd'); };
        __transactionTestHooks.beforePublishPath = ({ index }) => {
          if (fail && index === 1) throw new Error('injected partial publish failure');
        };
        try {
          const generate = () => runFreshWorkspaceTransaction(root, stage => {
            fs.writeFileSync(path.join(stage, 'first.txt'), 'first');
            fs.writeFileSync(path.join(stage, 'second.txt'), 'second');
          });
          if (fail) assert.throws(generate, /injected partial publish failure/);
          else generate();
          assert.equal(process.cwd(), canonical);
          assert.equal(fs.statSync('.').ino, identity.ino);
          assert.equal(fs.statSync('.').dev, identity.dev);
          assert.deepEqual(fs.readdirSync(root), fail ? [] : ['first.txt', 'second.txt']);
        } finally {
          fs.renameSync = rename;
          process.chdir = chdir;
          delete __transactionTestHooks.beforePublishPath;
          process.chdir(parent);
        }
      }
    `,
      ],
      { cwd: f.parent, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  } finally {
    f.clean();
  }
});
