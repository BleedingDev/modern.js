import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { UnsupportedUltramodernConfigError } from '../src/ultramodern-tooling/config';
import { addUltramodernVertical } from '../src/ultramodern-workspace';
import { createWorkspace, snapshotWorkspace } from './helpers/workspace-kit';

const ultramodernConfigPath = '.modernjs/ultramodern.json';
const topologyPath = 'topology/reference-topology.json';
const overlayPath = 'topology/local-overlays/development.json';

function readJson(workspaceDir: string, relativePath: string): any {
  return JSON.parse(
    fs.readFileSync(path.join(workspaceDir, relativePath), 'utf-8'),
  );
}

function writeJson(workspaceDir: string, relativePath: string, value: unknown) {
  fs.writeFileSync(
    path.join(workspaceDir, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf-8',
  );
}

function expectAddVerticalFailureLeavesWorkspaceUnchanged(
  workspaceDir: string,
  expectedError: RegExp,
) {
  const before = snapshotWorkspace(workspaceDir);
  assert.throws(
    () =>
      addUltramodernVertical({
        workspaceRoot: workspaceDir,
        name: 'checkout',
        modernVersion: '3.2.1',
      }),
    expectedError,
  );
  assert.deepEqual(snapshotWorkspace(workspaceDir), before);
}

type VerticalPatch = {
  id?: string;
  domain?: string;
  packageName?: string;
  verticalPath?: string;
  mfName?: string;
  port?: number;
  apiPrefix?: string;
};

function addExistingTopologyVertical(
  workspaceDir: string,
  patch: VerticalPatch,
) {
  const topology = readJson(workspaceDir, topologyPath);
  const overlay = readJson(workspaceDir, overlayPath);
  const id = patch.id ?? 'inventory';
  const domain = patch.domain ?? id;
  const port = patch.port ?? 4102;

  topology.verticals.push({
    id,
    kind: 'vertical',
    domain,
    package: patch.packageName ?? `@preflight-workspace/${id}`,
    path: patch.verticalPath ?? `verticals/${id}`,
    moduleFederation: {
      role: 'remote',
      name: patch.mfName ?? 'verticalInventory',
      manifestUrl: `http://localhost:${port}/mf-manifest.json`,
      exposes: ['./Route', './Widget'],
      ssr: true,
      sharedContractVersion: 'mf-ssr-contract-v1',
    },
    api: {
      runtime: 'effect',
      bff: { prefix: patch.apiPrefix ?? `/${id}-api` },
    },
  });
  overlay.ports[id] = port;
  writeJson(workspaceDir, topologyPath, topology);
  writeJson(workspaceDir, overlayPath, overlay);
}

test('add-vertical normalizes stale shell refs for the new vertical', () => {
  const { tempRoot, workspaceDir } = createWorkspace('preflight-workspace', {
    tempPrefix: 'um-vertical-preflight-',
  });
  try {
    const topology = readJson(workspaceDir, topologyPath);
    topology.shell.verticalRefs.push('catalog');
    topology.shell.moduleFederation.remotes.push({
      id: 'catalog',
      name: 'verticalCatalog',
      manifestUrl: 'http://localhost:4101/mf-manifest.json',
    });
    writeJson(workspaceDir, topologyPath, topology);
    addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });
    const updatedTopology = readJson(workspaceDir, topologyPath);
    assert.deepEqual(updatedTopology.shell.verticalRefs, ['catalog']);
    assert.deepEqual(updatedTopology.shell.moduleFederation.remotes, [
      {
        id: 'catalog',
        name: 'verticalCatalog',
        manifestUrl: 'http://localhost:4101/mf-manifest.json',
      },
    ]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('preflight rejects invalid fresh vertical input before writes', () => {
  const { tempRoot, workspaceDir } = createWorkspace('preflight-workspace', {
    tempPrefix: 'um-vertical-preflight-',
  });
  try {
    const before = snapshotWorkspace(workspaceDir);
    assert.throws(
      () =>
        addUltramodernVertical({
          workspaceRoot: workspaceDir,
          name: 'Catalog',
          modernVersion: '3.2.1',
        }),
      /Invalid Vertical name "Catalog"/,
    );
    assert.deepEqual(snapshotWorkspace(workspaceDir), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test.each([
  {
    label: 'unsupported app kind',
    mutate: (config: Record<string, any>) => {
      config.topology.apps[0].kind = 'horizontal-remote';
    },
    error: /Unsupported UltraModern config app kind "horizontal-remote"/,
    issue: {
      field: 'topology.apps.kind',
      index: 0,
      value: 'horizontal-remote',
    },
  },
])('preflight rejects $label before writes', entry => {
  const { tempRoot, workspaceDir } = createWorkspace('preflight-workspace', {
    tempPrefix: 'um-vertical-preflight-',
  });
  try {
    const config = readJson(workspaceDir, ultramodernConfigPath);
    entry.mutate(config);
    writeJson(workspaceDir, ultramodernConfigPath, config);
    const before = snapshotWorkspace(workspaceDir);
    assert.throws(
      () =>
        addUltramodernVertical({
          workspaceRoot: workspaceDir,
          name: 'checkout',
          modernVersion: '3.2.1',
        }),
      error => {
        const typedError = error as UnsupportedUltramodernConfigError;
        assert.equal(typedError.name, 'UnsupportedUltramodernConfigError');
        for (const [key, value] of Object.entries(entry.issue)) {
          assert.deepEqual(
            (typedError.issue as Record<string, unknown>)[key],
            value,
          );
        }
        assert.match(typedError.message, entry.error);
        return true;
      },
    );
    assert.deepEqual(snapshotWorkspace(workspaceDir), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test.each([
  {
    label: 'duplicate app IDs',
    mutate: (workspaceDir: string) =>
      addExistingTopologyVertical(workspaceDir, { id: 'catalog' }),
    error: /Duplicate app id "catalog"/,
  },
  {
    label: 'duplicate development ports',
    mutate: (workspaceDir: string) =>
      addExistingTopologyVertical(workspaceDir, { port: 4101 }),
    error: /Duplicate development port "4101"/,
  },
  {
    label: 'unsafe normalized existing descriptors',
    mutate: (workspaceDir: string) => {
      const topology = readJson(workspaceDir, topologyPath);
      topology.verticals[0].path = '../outside';
      writeJson(workspaceDir, topologyPath, topology);
    },
    error: /Unsafe output path for catalog: \.\.\/outside/,
  },
])('preflight rejects invalid existing state: $label', entry => {
  const workspace = createWorkspace('preflight-workspace', {
    tempPrefix: 'um-vertical-preflight-',
  });
  try {
    addUltramodernVertical({
      workspaceRoot: workspace.workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });
    entry.mutate(workspace.workspaceDir);
    expectAddVerticalFailureLeavesWorkspaceUnchanged(
      workspace.workspaceDir,
      entry.error,
    );
  } finally {
    fs.rmSync(workspace.tempRoot, { recursive: true, force: true });
  }
});

test('preflight rejects malformed contract collections before writes', () => {
  const topologyWorkspace = createWorkspace('preflight-workspace', {
    tempPrefix: 'um-vertical-preflight-',
  });
  const overlayWorkspace = createWorkspace('preflight-workspace', {
    tempPrefix: 'um-vertical-preflight-',
  });
  try {
    writeJson(topologyWorkspace.workspaceDir, topologyPath, []);
    expectAddVerticalFailureLeavesWorkspaceUnchanged(
      topologyWorkspace.workspaceDir,
      /UltraModern workspace file must contain a JSON object: .*reference-topology\.json/,
    );
    const overlay = readJson(overlayWorkspace.workspaceDir, overlayPath);
    overlay.ports = [];
    writeJson(overlayWorkspace.workspaceDir, overlayPath, overlay);
    expectAddVerticalFailureLeavesWorkspaceUnchanged(
      overlayWorkspace.workspaceDir,
      /overlay\.ports in .*development\.json must be a JSON object/,
    );
  } finally {
    fs.rmSync(topologyWorkspace.tempRoot, { recursive: true, force: true });
    fs.rmSync(overlayWorkspace.tempRoot, { recursive: true, force: true });
  }
});
