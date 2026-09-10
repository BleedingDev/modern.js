import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BASELINE_DEPENDENCY_PINS,
  generateUltramodernWorkspace,
  OverlayBaselineRelaxationError,
} from '../src/ultramodern-workspace';
import {
  assertOverlayPreservedBaseline,
  captureOverlayBaselineSnapshot,
} from '../src/ultramodern-workspace/overlay-baseline-guard';

function writeOverlayGenerator(tempRoot: string, name: string, body: string) {
  const generatorDir = path.join(tempRoot, name);
  fs.mkdirSync(generatorDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatorDir, 'package.json'),
    JSON.stringify({
      name: `test-${name}`,
      version: '0.0.0',
      main: './index.cjs',
    }),
  );
  fs.writeFileSync(path.join(generatorDir, 'index.cjs'), body);
  return generatorDir;
}

function generateWithOverlay(targetDir: string, generatorDir: string) {
  generateUltramodernWorkspace({
    targetDir,
    packageName: path.basename(targetDir),
    modernVersion: '3.2.1',
    enableTailwind: true,
    overlays: [{ generator: generatorDir }],
    packageSource: { strategy: 'workspace' },
  });
}

function assertRelaxationOverlay(
  tempRoot: string,
  name: string,
  mutation: string,
) {
  const generatorDir = writeOverlayGenerator(
    tempRoot,
    `${name}-overlay`,
    `
const fs = require('node:fs');
const path = require('node:path');
module.exports = async context => {
  const shellPkgPath = path.join(
    context.config.outputWorkspaceRoot,
    'apps/shell-super-app/package.json',
  );
  const shellPkg = JSON.parse(fs.readFileSync(shellPkgPath, 'utf-8'));
  ${mutation}
  fs.writeFileSync(shellPkgPath, JSON.stringify(shellPkg, null, 2));
};
`,
  );
  assert.throws(
    () => generateWithOverlay(path.join(tempRoot, name), generatorDir),
    (error: unknown) => {
      assert.ok(error instanceof OverlayBaselineRelaxationError, String(error));
      assert.ok(
        error.violations.some(
          violation =>
            violation.kind === 'baseline-version-relaxation' &&
            violation.detail.includes('react'),
        ),
        error.message,
      );
      return true;
    },
  );
}

test('overlay baseline guard keeps one rejection matrix and a neutral extension', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-overlay-guard-'));
  try {
    for (const [name, mutation] of [
      ['downgrade', "shellPkg.dependencies.react = '18.0.0';"],
      ['remove', 'delete shellPkg.dependencies.react;'],
      [
        'npm-alias',
        "shellPkg.dependencies['react-alias'] = 'npm:react@18.0.0';",
      ],
      ['overrides', "shellPkg.overrides = { tooling: { react: '18.0.0' } };"],
      ['resolutions', "shellPkg.resolutions = { react: '18.0.0' };"],
      ['pnpm-overrides', "shellPkg.pnpm = { overrides: { react: '18.0.0' } };"],
      ['catalog', "shellPkg.catalog = { react: '18.0.0' };"],
    ] as const) {
      assertRelaxationOverlay(tempRoot, name, mutation);
    }

    const neutralGenerator = writeOverlayGenerator(
      tempRoot,
      'neutral-overlay',
      `
const fs = require('node:fs');
const path = require('node:path');
module.exports = async context => {
  const outDir = path.join(context.config.outputWorkspaceRoot, 'overlay-output');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ok.json'), JSON.stringify({ ok: true }));
};
`,
    );
    const targetDir = path.join(tempRoot, 'neutral');
    generateWithOverlay(targetDir, neutralGenerator);
    assert.equal(
      fs.existsSync(path.join(targetDir, 'overlay-output/ok.json')),
      true,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('workspace catalog baseline changes fail with a typed violation', () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-overlay-catalog-'),
  );
  const workspaceRoot = path.join(tempRoot, 'workspace');
  const workspaceYamlPath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  try {
    fs.mkdirSync(workspaceRoot, { recursive: true });
    fs.writeFileSync(
      workspaceYamlPath,
      `catalog:\n  react: '${BASELINE_DEPENDENCY_PINS.react}'\n`,
    );
    const snapshot = captureOverlayBaselineSnapshot(workspaceRoot, []);
    fs.writeFileSync(workspaceYamlPath, "catalog:\n  react: '18.0.0'\n");

    assert.throws(
      () =>
        assertOverlayPreservedBaseline({
          workspaceRoot,
          generator: 'catalog-replacement-overlay',
          snapshot,
        }),
      (error: unknown) => {
        assert.ok(error instanceof OverlayBaselineRelaxationError);
        assert.ok(
          error.violations.some(
            violation => violation.path === 'pnpm-workspace.yaml#catalog.react',
          ),
          error.message,
        );
        return true;
      },
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
