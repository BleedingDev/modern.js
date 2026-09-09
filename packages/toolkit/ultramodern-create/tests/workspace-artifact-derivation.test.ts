import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMigrateStrictEffect } from '../src/ultramodern-tooling/commands/migrate-strict-effect';
import { createMigrationIo } from '../src/ultramodern-tooling/commands/migrate-strict-effect/io';
import { preserveConsumerWorkspaceArtifacts } from '../src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership';
import { normalizeWorkspaceInputs } from '../src/ultramodern-tooling/config';
import {
  addUltramodernShell,
  addUltramodernVertical,
} from '../src/ultramodern-workspace';
import { formatGeneratedWorkspaceFiles } from '../src/ultramodern-workspace/fs-io';
import {
  createWorkspaceScriptArtifacts,
  writeGeneratedWorkspaceScripts,
} from '../src/ultramodern-workspace/workspace-scripts';
import { createWorkspace } from './helpers/workspace-kit';

const configPath = '.modernjs/ultramodern.json';
const topologyPath = 'topology/reference-topology.json';
const overlayPath = 'topology/local-overlays/development.json';
const primaryDirectory = 'apps/shell-super-app';

function readJson(root: string, relativePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(root: string, relativePath: string, value: unknown) {
  fs.writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function migrate(workspaceRoot: string) {
  assert.equal(
    runMigrateStrictEffect(['--skip-install'], {
      workspaceRoot,
      invocationCwd: workspaceRoot,
    }),
    0,
  );
}

for (const shape of [
  'shell-only',
  'ui-only',
  'api-bearing',
  'multiple-shells',
] as const) {
  test(`fresh/add-vertical/migration share script bytes for ${shape} inputs`, () => {
    const { tempRoot, workspaceDir } = createWorkspace('artifact-parity', {
      tempPrefix: 'um-artifact-parity-',
    });
    const freshRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'um-script-projection-'),
    );
    try {
      if (shape !== 'shell-only') {
        addUltramodernVertical({
          workspaceRoot: workspaceDir,
          name: 'orders',
          modernVersion: '3.2.1',
          preset: shape === 'ui-only' ? 'ui-only' : undefined,
        });
      }
      if (shape === 'multiple-shells') {
        addUltramodernShell({
          workspaceRoot: workspaceDir,
          name: 'admin',
          modernVersion: '3.2.1',
          verticals: [],
        });
      }
      const config = readJson(workspaceDir, configPath);
      const overlay = readJson(workspaceDir, overlayPath);
      const view = normalizeWorkspaceInputs(workspaceDir, {
        config,
        topology: readJson(workspaceDir, topologyPath),
        overlay,
      });
      writeGeneratedWorkspaceScripts(
        freshRoot,
        view.config.workspace.packageScope,
        view.config.features.tailwind,
        view.verticals,
        undefined,
        view.additionalShells,
        view.primaryShell,
        {
          compactConfig: config,
          developmentOverlay: overlay,
          ownership: readJson(workspaceDir, 'topology/ownership.json'),
        },
      );
      const artifacts = createWorkspaceScriptArtifacts({
        shellOnly: view.verticals.length === 0,
        hasBackendSurface: view.verticals.some(app => app.api !== undefined),
      });
      const paths = artifacts.map(artifact => artifact.relativePath);
      formatGeneratedWorkspaceFiles(freshRoot, paths);
      // The validator has contextual cohort/metadata data; all shared runtime
      // wrappers and copied assets must be identical across actual writers.
      const sharedPaths = paths.filter(
        relativePath =>
          relativePath !== 'scripts/validate-ultramodern-workspace.mts',
      );
      for (const relativePath of sharedPaths) {
        assert.equal(
          fs.readFileSync(path.join(workspaceDir, relativePath), 'utf8'),
          fs.readFileSync(path.join(freshRoot, relativePath), 'utf8'),
          relativePath,
        );
      }
      migrate(workspaceDir);
      for (const relativePath of sharedPaths) {
        assert.equal(
          fs.readFileSync(path.join(workspaceDir, relativePath), 'utf8'),
          fs.readFileSync(path.join(freshRoot, relativePath), 'utf8'),
          relativePath,
        );
      }
      assert.equal(
        fs.existsSync(
          path.join(workspaceDir, 'scripts/materialize-zerops-runtime.mjs'),
        ),
        shape !== 'shell-only',
      );
      assert.equal(
        fs.existsSync(
          path.join(
            workspaceDir,
            'scripts/generate-node-backend-federation.mts',
          ),
        ),
        shape !== 'shell-only' && shape !== 'ui-only',
      );
      const validation = spawnSync(
        process.execPath,
        ['scripts/validate-ultramodern-workspace.mts'],
        { cwd: workspaceDir, encoding: 'utf8' },
      );
      assert.equal(validation.status, 0, validation.stdout + validation.stderr);
      if (shape === 'multiple-shells') {
        assert.deepEqual(
          readJson(workspaceDir, configPath).shells[0].verticalRefs,
          [],
        );
        assert.equal(
          Object.hasOwn(
            readJson(workspaceDir, overlayPath).ports,
            'shell-admin',
          ),
          false,
        );
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.rmSync(freshRoot, { recursive: true, force: true });
    }
  });
}

test('add-vertical and migration conserve authored config, script segments and live ports', () => {
  const { tempRoot, workspaceDir } = createWorkspace('artifact-custom', {
    tempPrefix: 'um-artifact-custom-',
  });
  try {
    const config = readJson(workspaceDir, configPath);
    config.consumer = { custom: ['keep'] };
    config.workspace.consumerWorkspace = true;
    config.workspace.packageManager.consumerPackageManager = true;
    config.moduleFederation.apps[0].consumerProjection = true;
    config.features.consumerFeature = false;
    config.topology.consumerTopology = true;
    config.topology.apps[0].consumerApp = true;
    config.topology.apps[0].moduleFederation.consumerMf = true;
    writeJson(workspaceDir, configPath, config);
    const topology = readJson(workspaceDir, topologyPath);
    topology.consumerTopology = { keep: true };
    writeJson(workspaceDir, topologyPath, topology);
    const overlay = readJson(workspaceDir, overlayPath);
    overlay.ports['shell-super-app'] = 3120;
    overlay.ports.consumerPort = 9999;
    overlay.consumerOverlay = { keep: true };
    writeJson(workspaceDir, overlayPath, overlay);
    const rootPackage = readJson(workspaceDir, 'package.json');
    rootPackage.scripts['consumer:check'] = 'echo consumer';
    rootPackage.scripts.check = `pnpm consumer:check && ${rootPackage.scripts.check}`;
    rootPackage.scripts.build += ' && echo consumer-build';
    writeJson(workspaceDir, 'package.json', rootPackage);
    const shellPackage = readJson(
      workspaceDir,
      `${primaryDirectory}/package.json`,
    );
    shellPackage.consumerPackage = true;
    shellPackage.scripts.build += ' && echo consumer-shell';
    shellPackage.scripts['consumer:task'] = 'echo task';
    writeJson(workspaceDir, `${primaryDirectory}/package.json`, shellPackage);
    const authoredPaths = [
      `${primaryDirectory}/modern.config.ts`,
      `${primaryDirectory}/module-federation.config.ts`,
      `${primaryDirectory}/src/routes/[lang]/page.tsx`,
      'scripts/bootstrap-agent-skills.mts',
    ];
    const authored = Object.fromEntries(
      authoredPaths.map(relativePath => {
        const content = `${fs.readFileSync(path.join(workspaceDir, relativePath), 'utf8')}\n// Consumer extension.\n`;
        fs.writeFileSync(path.join(workspaceDir, relativePath), content);
        return [relativePath, content];
      }),
    );
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'orders',
      modernVersion: '3.2.1',
    });
    for (const phase of ['add', 'migrate']) {
      if (phase === 'migrate') migrate(workspaceDir);
      for (const [relativePath, content] of Object.entries(authored)) {
        assert.equal(
          fs.readFileSync(path.join(workspaceDir, relativePath), 'utf8'),
          content,
          `${phase}: ${relativePath}`,
        );
      }
      const current = readJson(workspaceDir, configPath);
      assert.deepEqual(current.consumer, config.consumer);
      assert.equal(current.workspace.consumerWorkspace, true);
      assert.equal(
        current.workspace.packageManager.consumerPackageManager,
        true,
      );
      assert.equal(current.moduleFederation.apps[0].consumerProjection, true);
      assert.equal(current.features.consumerFeature, false);
      assert.equal(current.topology.consumerTopology, true);
      assert.equal(current.topology.apps[0].consumerApp, true);
      assert.equal(current.topology.apps[0].port, config.topology.apps[0].port);
      assert.equal(current.topology.apps[0].moduleFederation.consumerMf, true);
      assert.deepEqual(
        readJson(workspaceDir, topologyPath).consumerTopology,
        topology.consumerTopology,
      );
      assert.equal(
        readJson(workspaceDir, overlayPath).ports['shell-super-app'],
        3120,
      );
      assert.equal(
        readJson(workspaceDir, overlayPath).ports.consumerPort,
        9999,
      );
      const scripts = readJson(workspaceDir, 'package.json').scripts;
      assert.equal(scripts['consumer:check'], 'echo consumer');
      assert.match(scripts.check, /pnpm consumer:check/);
      assert.match(scripts.build, /echo consumer-build/);
      const currentShell = readJson(
        workspaceDir,
        `${primaryDirectory}/package.json`,
      );
      assert.equal(currentShell.consumerPackage, true);
      assert.match(currentShell.scripts.build, /echo consumer-shell/);
      assert.equal(currentShell.scripts['consumer:task'], 'echo task');
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('adding to another shell retains explicit empty primary composition', () => {
  const { tempRoot, workspaceDir } = createWorkspace('artifact-empty-primary', {
    tempPrefix: 'um-artifact-empty-',
  });
  try {
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'orders',
      modernVersion: '3.2.1',
    });
    addUltramodernShell({
      workspaceRoot: workspaceDir,
      name: 'admin',
      modernVersion: '3.2.1',
      verticals: [],
    });
    const topology = readJson(workspaceDir, topologyPath);
    topology.shell.verticalRefs = [];
    writeJson(workspaceDir, topologyPath, topology);
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'payments',
      modernVersion: '3.2.1',
      shell: 'shell-admin',
    });
    for (const phase of ['add', 'migrate']) {
      if (phase === 'migrate') migrate(workspaceDir);
      const config = readJson(workspaceDir, configPath);
      assert.deepEqual(
        config.topology.apps[0].moduleFederation.verticalRefs,
        [],
      );
      assert.deepEqual(
        readJson(workspaceDir, topologyPath).shell.verticalRefs,
        [],
      );
      assert.deepEqual(config.shells[0].verticalRefs, ['payments']);
      const primaryPackage = readJson(
        workspaceDir,
        `${primaryDirectory}/package.json`,
      );
      assert.equal(primaryPackage['zephyr:dependencies']?.orders, undefined);
      assert.equal(primaryPackage['zephyr:dependencies']?.payments, undefined);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migration derives remote URLs from live ports and preserves authored URL overrides', () => {
  const { tempRoot, workspaceDir } = createWorkspace('artifact-live-remote', {
    tempPrefix: 'um-artifact-remote-',
  });
  try {
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'orders',
      modernVersion: '3.2.1',
    });
    const compactPort = readJson(workspaceDir, configPath).topology.apps.find(
      (app: Record<string, any>) => app.id === 'orders',
    ).port;
    assert.notEqual(compactPort, 3121);
    const overlay = readJson(workspaceDir, overlayPath);
    overlay.ports.orders = 3121;
    // Existing generated compact-port URLs must follow the live port.
    writeJson(workspaceDir, overlayPath, overlay);
    addUltramodernShell({
      workspaceRoot: workspaceDir,
      name: 'admin',
      verticals: ['orders'],
      modernVersion: '3.2.1',
    });
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      preset: 'ui-only',
      modernVersion: '3.2.1',
    });
    assert.equal(
      readJson(workspaceDir, overlayPath).manifests.orders,
      'http://localhost:3121/mf-manifest.json',
    );
    assert.equal(
      readJson(workspaceDir, configPath).topology.apps.find(
        (app: Record<string, any>) => app.id === 'orders',
      ).port,
      compactPort,
    );
    const addedValidation = spawnSync(
      process.execPath,
      ['scripts/validate-ultramodern-workspace.mts'],
      { cwd: workspaceDir, encoding: 'utf8' },
    );
    assert.equal(
      addedValidation.status,
      0,
      addedValidation.stdout + addedValidation.stderr,
    );
    migrate(workspaceDir);
    assert.equal(
      readJson(workspaceDir, configPath).topology.apps.find(
        (app: Record<string, any>) => app.id === 'orders',
      ).port,
      compactPort,
    );
    const effective = readJson(workspaceDir, overlayPath);
    assert.equal(effective.ports.orders, 3121);
    assert.equal(
      effective.manifests.orders,
      'http://localhost:3121/mf-manifest.json',
    );
    assert.equal(new URL(effective.apis.orders).port, '3121');
    const validation = spawnSync(
      process.execPath,
      ['scripts/validate-ultramodern-workspace.mts'],
      { cwd: workspaceDir, encoding: 'utf8' },
    );
    assert.equal(validation.status, 0, validation.stdout + validation.stderr);
    // URLs already set to the effective port remain stable on another pass.
    migrate(workspaceDir);
    assert.deepEqual(readJson(workspaceDir, overlayPath), effective);
    effective.manifests.orders =
      'https://federation.example.test/orders/custom-manifest.json';
    effective.apis.orders = 'https://api.example.test/custom/orders';
    writeJson(workspaceDir, overlayPath, effective);
    migrate(workspaceDir);
    const authored = readJson(workspaceDir, overlayPath);
    assert.equal(authored.ports.orders, 3121);
    assert.equal(authored.manifests.orders, effective.manifests.orders);
    assert.equal(authored.apis.orders, effective.apis.orders);
    // Overlay URL maps are metadata, not runtime override inputs: keep the
    // consumer bytes, and retain the validator's explicit contract conflict.
    const unsupportedOverride = spawnSync(
      process.execPath,
      ['scripts/validate-ultramodern-workspace.mts'],
      { cwd: workspaceDir, encoding: 'utf8' },
    );
    assert.notEqual(unsupportedOverride.status, 0);
    assert.match(
      unsupportedOverride.stdout + unsupportedOverride.stderr,
      /local-overlays\/development\.json manifests\.orders/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('artifact ownership accepts any exact candidate independent of order and preserves unmatched bytes', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-artifact-candidates-'),
  );
  const relativePath = 'owned.txt';
  const artifactPath = path.join(root, relativePath);
  const before = { relativePath, content: 'generated compact port\n' };
  const effective = { relativePath, content: 'generated live port\n' };
  try {
    for (const candidates of [
      [before, effective],
      [effective, before],
      [before, before, effective],
    ]) {
      for (const current of [effective.content, 'consumer replacement\n']) {
        fs.writeFileSync(artifactPath, current);
        const guarded = preserveConsumerWorkspaceArtifacts(
          createMigrationIo(root, false),
          candidates,
        );
        guarded.io.write(artifactPath, 'next generated projection\n');
        assert.equal(
          fs.readFileSync(artifactPath, 'utf8'),
          current === effective.content
            ? 'next generated projection\n'
            : current,
        );
      }
    }
    fs.writeFileSync(artifactPath, effective.content);
    fs.writeFileSync(
      path.join(root, 'legacy.txt'),
      'consumer legacy replacement\n',
    );
    const paired = preserveConsumerWorkspaceArtifacts(
      createMigrationIo(root, false),
      [
        { ...before, legacyPath: 'legacy.txt' },
        { ...effective, legacyPath: 'legacy.txt' },
      ],
    );
    paired.io.write(artifactPath, 'next generated projection\n');
    assert.equal(fs.readFileSync(artifactPath, 'utf8'), effective.content);
    assert.equal(paired.preservedPaths.has('legacy.txt'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
