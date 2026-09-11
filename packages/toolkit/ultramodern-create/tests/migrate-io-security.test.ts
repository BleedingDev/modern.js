import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createMigrationIo,
  listWorkspacePackageFiles,
  withStagedDryRunMigrationIo,
} from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';

const directorySymlinkType = process.platform === 'win32' ? 'junction' : 'dir';

function createDirectoryLink(targetPath: string, linkPath: string) {
  fs.symlinkSync(targetPath, linkPath, directorySymlinkType);
}

test('migration rollback restores directory links with their cross-platform type', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-io-directory-link-rollback-'),
  );
  const workspaceRoot = path.join(temporaryRoot, 'workspace');
  const targetRoot = path.join(workspaceRoot, 'directory-target');
  const linkedRoot = path.join(workspaceRoot, 'directory-link');
  const targetFile = path.join(targetRoot, 'preserved.txt');

  try {
    fs.mkdirSync(targetRoot, { recursive: true });
    fs.writeFileSync(targetFile, 'preserved\n');
    createDirectoryLink(targetRoot, linkedRoot);

    const io = createMigrationIo(workspaceRoot, false);
    assert.throws(
      () =>
        io.transaction(() => {
          assert.equal(io.remove(linkedRoot), true);
          throw new Error('force directory-link rollback');
        }),
      /force directory-link rollback/u,
    );

    assert.equal(fs.lstatSync(linkedRoot).isSymbolicLink(), true);
    assert.equal(fs.statSync(linkedRoot).isDirectory(), true);
    assert.equal(
      fs.readFileSync(path.join(linkedRoot, 'preserved.txt'), 'utf-8'),
      'preserved\n',
    );
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('migration IO refuses writes and removals through an escaping ancestor symlink', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-io-symlink-'),
  );
  const workspaceRoot = path.join(temporaryRoot, 'workspace');
  const outsideRoot = path.join(temporaryRoot, 'outside');
  const outsideTarget = path.join(outsideRoot, 'config.json');

  try {
    fs.mkdirSync(workspaceRoot);
    fs.mkdirSync(outsideRoot);
    fs.writeFileSync(outsideTarget, 'original\n');
    createDirectoryLink(outsideRoot, path.join(workspaceRoot, 'apps'));

    const io = createMigrationIo(workspaceRoot, false);
    const escapedPath = path.join(workspaceRoot, 'apps/config.json');

    assert.throws(
      () => io.write(escapedPath, 'changed\n'),
      /outside workspace|symlink/u,
    );
    assert.equal(fs.readFileSync(outsideTarget, 'utf-8'), 'original\n');
    assert.throws(() => io.remove(escapedPath), /outside workspace|symlink/u);
    assert.equal(fs.readFileSync(outsideTarget, 'utf-8'), 'original\n');
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('migration IO rejects escaping final-link writes but safely removes the link itself', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-io-final-symlink-'),
  );
  const workspaceRoot = path.join(temporaryRoot, 'workspace');
  const outsideRoot = path.join(temporaryRoot, 'outside');
  const danglingTarget = path.join(outsideRoot, 'missing.json');
  const preservedTarget = path.join(outsideRoot, 'preserved.json');
  const danglingLink = path.join(workspaceRoot, 'dangling.json');
  const removableLink = path.join(workspaceRoot, 'removable.json');

  try {
    fs.mkdirSync(workspaceRoot);
    fs.mkdirSync(outsideRoot);
    fs.writeFileSync(preservedTarget, 'preserved\n');
    fs.symlinkSync(danglingTarget, danglingLink, 'file');
    fs.symlinkSync(preservedTarget, removableLink, 'file');

    const io = createMigrationIo(workspaceRoot, false);
    assert.throws(
      () => io.write(danglingLink, 'escaped\n'),
      /outside workspace|symlink/u,
    );
    assert.equal(fs.existsSync(danglingTarget), false);
    assert.equal(fs.lstatSync(danglingLink).isSymbolicLink(), true);

    assert.equal(io.remove(removableLink), true);
    assert.equal(fs.existsSync(removableLink), false);
    assert.equal(fs.readFileSync(preservedTarget, 'utf-8'), 'preserved\n');
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('migration IO supports a symlinked workspace root and in-root directory aliases', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-io-linked-root-'),
  );
  const realWorkspaceRoot = path.join(temporaryRoot, 'real-workspace');
  const linkedWorkspaceRoot = path.join(temporaryRoot, 'workspace');
  const realAppsRoot = path.join(realWorkspaceRoot, 'real-apps');
  const linkedTarget = path.join(linkedWorkspaceRoot, 'apps/config.json');
  const realTarget = path.join(realAppsRoot, 'config.json');

  try {
    fs.mkdirSync(realAppsRoot, { recursive: true });
    createDirectoryLink(realWorkspaceRoot, linkedWorkspaceRoot);
    createDirectoryLink(realAppsRoot, path.join(realWorkspaceRoot, 'apps'));

    const io = createMigrationIo(linkedWorkspaceRoot, false);
    assert.equal(io.write(linkedTarget, 'linked\n'), true);
    assert.equal(fs.readFileSync(realTarget, 'utf-8'), 'linked\n');
    assert.equal(io.remove(linkedTarget), true);
    assert.equal(fs.existsSync(realTarget), false);
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('migration dry-run performs no target mutation through an escaping ancestor symlink', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-io-dry-run-'),
  );
  const workspaceRoot = path.join(temporaryRoot, 'workspace');
  const outsideRoot = path.join(temporaryRoot, 'outside');
  const outsideTarget = path.join(outsideRoot, 'config.json');

  try {
    fs.mkdirSync(workspaceRoot);
    fs.mkdirSync(outsideRoot);
    fs.writeFileSync(outsideTarget, 'original\n');
    createDirectoryLink(outsideRoot, path.join(workspaceRoot, 'apps'));

    assert.throws(
      () =>
        withStagedDryRunMigrationIo(workspaceRoot, io =>
          io.write(
            path.join(io.workspaceRoot, 'apps/config.json'),
            'changed\n',
          ),
        ),
      /outside workspace|symlink/u,
    );
    assert.equal(fs.readFileSync(outsideTarget, 'utf-8'), 'original\n');
    assert.throws(
      () =>
        withStagedDryRunMigrationIo(workspaceRoot, io =>
          io.remove(path.join(io.workspaceRoot, 'apps/config.json')),
        ),
      /outside workspace|symlink/u,
    );
    assert.equal(fs.readFileSync(outsideTarget, 'utf-8'), 'original\n');
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('staged migration dry-run does not follow a symlinked workspace root back to its source', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-io-staged-linked-root-'),
  );
  const realWorkspaceRoot = path.join(temporaryRoot, 'real-workspace');
  const linkedWorkspaceRoot = path.join(temporaryRoot, 'workspace');
  const realAppsRoot = path.join(realWorkspaceRoot, 'real-apps');
  const existingPath = path.join(realAppsRoot, 'existing.txt');
  const newPath = path.join(realAppsRoot, 'new.txt');

  try {
    fs.mkdirSync(realAppsRoot, { recursive: true });
    fs.writeFileSync(existingPath, 'original\n');
    createDirectoryLink(realWorkspaceRoot, linkedWorkspaceRoot);
    createDirectoryLink(
      path.join(linkedWorkspaceRoot, 'real-apps'),
      path.join(realWorkspaceRoot, 'apps'),
    );

    withStagedDryRunMigrationIo(linkedWorkspaceRoot, io => {
      assert.equal(
        io.write(path.join(io.workspaceRoot, 'apps/new.txt'), 'projected\n'),
        true,
      );
      assert.equal(
        io.remove(path.join(io.workspaceRoot, 'apps/existing.txt')),
        true,
      );
    });

    assert.equal(fs.existsSync(newPath), false);
    assert.equal(fs.readFileSync(existingPath, 'utf-8'), 'original\n');
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('declared local nested participants are enumerated without admitting external workspace paths', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-participants-'),
  );
  const workspaceRoot = path.join(temporaryRoot, 'workspace');
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'features/nested/app'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(workspaceRoot, 'domain/core'), { recursive: true });
    fs.mkdirSync(path.join(temporaryRoot, 'external'), { recursive: true });
    for (const file of [
      'package.json',
      'features/nested/app/package.json',
      'domain/core/package.json',
    ]) {
      fs.writeFileSync(path.join(workspaceRoot, file), '{}\n');
    }
    fs.writeFileSync(
      path.join(temporaryRoot, 'external/package.json'),
      '{"private":true}\n',
    );
    assert.deepEqual(
      listWorkspacePackageFiles(workspaceRoot, {
        appDirectories: ['features/nested/app'],
        workspacePatterns: ['domain/*'],
      }),
      [
        'domain/core/package.json',
        'features/nested/app/package.json',
        'package.json',
      ],
    );
    assert.throws(
      () =>
        listWorkspacePackageFiles(workspaceRoot, {
          workspacePatterns: ['../external'],
        }),
      /External workspace participant requires coordinated ownership/,
    );
    assert.equal(
      fs.readFileSync(
        path.join(temporaryRoot, 'external/package.json'),
        'utf8',
      ),
      '{"private":true}\n',
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
