import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rstest } from '@rstest/core';
import { runUltramodernToolingCli } from '../src/ultramodern-tooling/commands';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { readFileTemplate } from '../src/ultramodern-workspace/fs-io';
import { generateUltramodernWorkspace } from '../src/ultramodern-workspace/index';
import {
  createWorkspace,
  linkWorkspaceFormatterDependencies,
} from './helpers/workspace-kit';

const packageSource = { strategy: 'workspace' } as const;
const packageRoot = path.resolve(__dirname, '..');
const toolDependencyNodeModules = path.dirname(
  fs.realpathSync(path.join(packageRoot, 'node_modules/ultracite')),
);
const oxfmtCliPath = path.join(toolDependencyNodeModules, 'oxfmt/bin/oxfmt');
const oxlintCliPath = path.join(toolDependencyNodeModules, 'oxlint/bin/oxlint');

function runTool(cliPath: string, args: string[], workspaceRoot: string) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

function toolOutput(result: ReturnType<typeof runTool>) {
  return `${result.stdout}\n${result.stderr}`;
}

function assertGeneratedFilesAreFormatted(
  workspaceRoot: string,
  relativePaths: readonly string[],
  mode: '--check' | '--write' = '--check',
) {
  const result = runTool(
    path.resolve(__dirname, '../node_modules/oxfmt/bin/oxfmt'),
    [mode, '--no-error-on-unmatched-pattern', ...relativePaths],
    workspaceRoot,
  );
  assert.equal(result.status, 0, toolOutput(result));
}

function readAllFiles(workspaceRoot: string) {
  return new Map(
    fs
      .readdirSync(workspaceRoot, { recursive: true })
      .map(relative => String(relative).split(path.sep).join('/'))
      .filter(relative =>
        fs.lstatSync(path.join(workspaceRoot, relative)).isFile(),
      )
      .sort()
      .map(relative => [
        relative,
        fs.readFileSync(path.join(workspaceRoot, relative)),
      ]),
  );
}

test('dry-run writes nothing yet previews every file the real migration changes, formatted with consumer settings that survive untouched', async () => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-native-format-preview-'),
  );
  const output = rstest.spyOn(process.stdout, 'write').mockReturnValue(true);
  try {
    generateUltramodernWorkspace({
      targetDir: workspaceRoot,
      packageName: 'native-format-preview',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource,
    });
    fs.writeFileSync(
      path.join(workspaceRoot, 'oxfmt.config.ts'),
      'export default { printWidth: 80, singleQuote: false, trailingComma: "none" };\n',
    );
    assertGeneratedFilesAreFormatted(
      workspaceRoot,
      ['apps', 'verticals', 'packages', 'scripts'],
      '--write',
    );
    const relativePath = 'scripts/ultramodern-performance-readiness.config.mjs';
    fs.writeFileSync(
      path.join(workspaceRoot, relativePath),
      readFileTemplate(
        'workspace-scripts/ultramodern-performance-readiness.config.mjs',
      ),
    );
    const authoredPath = 'packages/authored-format.ts';
    fs.writeFileSync(
      path.join(workspaceRoot, authoredPath),
      'export const authored =  { preserve: "spacing" };\n',
    );
    const before = readAllFiles(workspaceRoot);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--dry-run'],
        workspaceRoot,
      ),
      0,
    );
    const preview = output.mock.calls.map(([chunk]) => String(chunk)).join('');
    assert.deepEqual(readAllFiles(workspaceRoot), before);
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );
    assertGeneratedFilesAreFormatted(workspaceRoot, [
      relativePath,
      'apps/shell-super-app/modern.config.ts',
    ]);
    for (const preserved of ['oxfmt.config.ts', authoredPath]) {
      assert.deepEqual(
        fs.readFileSync(path.join(workspaceRoot, preserved)),
        before.get(preserved),
      );
    }
    const after = readAllFiles(workspaceRoot);
    const planned = new Set(
      preview.split('\n').flatMap(line => {
        const match = /^\[dry-run\] would (?:write|delete) (.+)$/u.exec(line);
        return match ? [match[1]] : [];
      }),
    );
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      relative =>
        !before.get(relative)?.equals(after.get(relative) ?? Buffer.alloc(0)),
    );
    assert.ok(changed.includes(relativePath), 'formatting-only write was lost');
    assert.deepEqual(
      changed.filter(relative => !planned.has(relative)),
      [],
    );
  } finally {
    output.mockRestore();
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

test('generated formatting failure rolls back the transaction', () => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-migrate-format-rollback-'),
  );
  const generatedPath = path.join(workspaceRoot, 'generated.ts');
  const original = Buffer.from('export const original = true;\n');
  try {
    fs.writeFileSync(generatedPath, original);
    const io = createMigrationIo(workspaceRoot, false);
    assert.throws(
      () =>
        io.transaction(() => {
          io.writeGenerated(generatedPath, 'export const = ;\n');
        }),
      /Failed to format generated UltraModern workspace output/u,
    );
    assert.deepEqual(fs.readFileSync(generatedPath), original);
  } finally {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

test('migration restores executable Ultracite format and lint policies', async () => {
  const { tempRoot, workspaceDir: workspaceRoot } = createWorkspace(
    'migrated-tool-config',
    { tempPrefix: 'um-migrated-tool-config-' },
  );
  linkWorkspaceFormatterDependencies(workspaceRoot);
  fs.writeFileSync(
    path.join(workspaceRoot, 'oxfmt.config.ts'),
    `import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: [],
});
`,
  );
  fs.writeFileSync(
    path.join(workspaceRoot, 'oxlint.config.ts'),
    `import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';
export default { extends: [core, react] };
`,
  );
  const formatProbe = path.join('packages', 'format-probe.tsx');
  fs.writeFileSync(
    path.join(workspaceRoot, formatProbe),
    'export const Probe = () => <div className="p-4 flex items-center">probe</div>;\n',
  );
  const lintProbe = path.join('packages', 'component-probe.tsx');
  fs.writeFileSync(
    path.join(workspaceRoot, lintProbe),
    'export const ArrowComponent = () => <div />;\n',
  );

  try {
    assert.equal(
      await runUltramodernToolingCli(
        ['migrate-strict-effect', '--skip-install'],
        workspaceRoot,
      ),
      0,
    );

    const initialFormatCheck = runTool(
      oxfmtCliPath,
      ['--config', 'oxfmt.config.ts', '--check', formatProbe],
      workspaceRoot,
    );
    assert.equal(
      initialFormatCheck.status,
      1,
      `migrated formatter did not apply the Ultracite policy.\n${toolOutput(initialFormatCheck)}`,
    );
    const format = runTool(
      oxfmtCliPath,
      ['--config', 'oxfmt.config.ts', formatProbe],
      workspaceRoot,
    );
    assert.equal(format.status, 0, toolOutput(format));
    const finalFormatCheck = runTool(
      oxfmtCliPath,
      ['--config', 'oxfmt.config.ts', '--check', formatProbe],
      workspaceRoot,
    );
    assert.equal(finalFormatCheck.status, 0, toolOutput(finalFormatCheck));

    const lint = runTool(
      oxlintCliPath,
      ['--config', 'oxlint.config.ts', lintProbe],
      workspaceRoot,
    );
    assert.equal(lint.status, 0, toolOutput(lint));
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});
