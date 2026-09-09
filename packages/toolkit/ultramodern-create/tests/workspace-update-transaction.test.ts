import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  __transactionTestHooks,
  recoverWorkspaceTransactions,
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
      0o640,
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

test('hard interruption during promotion recovers exact preimages before retry', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root, 'second.json'), 'before second');
    const crashed = crashDuringPublication(f.root);
    assert.equal(crashed.signal, 'SIGKILL', crashed.stderr);
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
      0o640,
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
    assert.equal(crashDuringPublication(f.root).signal, 'SIGKILL');
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
