import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  allWorkspaceAppsFromToolingConfig,
  normalizeCompactUltramodernConfig,
  normalizeWorkspaceInputs,
  readUltramodernConfig,
  readUltramodernWorkspaceInputs,
} from '../src/ultramodern-tooling/config';
import { shellApp } from '../src/ultramodern-workspace/descriptors';

function inputs() {
  return {
    config: {
      schemaVersion: 1,
      workspace: { packageScope: '@test', customWorkspaceChoice: true },
      customRoot: { deployment: 'consumer-owned' },
      topology: {
        apps: [
          {
            id: shellApp.id,
            kind: 'shell',
            path: 'apps/custom-shell',
            port: 3000,
            customApp: 'preserve',
            moduleFederation: { verticalRefs: ['orders'], customMf: true },
          },
          {
            id: 'orders',
            kind: 'vertical',
            path: 'verticals/orders',
            port: 3001,
            moduleFederation: { exposes: ['./Route'] },
          },
        ],
      },
      shells: [
        {
          id: 'shell-admin',
          name: 'admin',
          path: 'apps/admin',
          port: 3300,
          verticalRefs: [],
          customShell: { keep: true },
        },
      ],
    },
    topology: {
      shell: { verticalRefs: [], customComposition: 'preserve' },
      verticals: [
        {
          id: 'orders',
          path: 'verticals/orders',
          customTopologyField: true,
          moduleFederation: { exposes: ['./Route'], verticalRefs: [] },
        },
      ],
      customTopology: true,
    },
    overlay: {
      ports: { [shellApp.id]: 3120, orders: 3121 },
      customOverlay: { host: 'consumer.example' },
    },
  };
}

test('workspace reads retain unknown input fields without mutating consumer inputs', () => {
  const raw = inputs();
  const before = structuredClone(raw);
  const view = normalizeWorkspaceInputs('/workspace', raw);
  assert.equal(view.raw, raw);
  assert.deepEqual(view.raw, before);
  assert.equal(view.primaryShell?.directory, 'apps/custom-shell');
  assert.equal(view.primaryShell?.port, 3120);
  assert.equal(view.verticals[0].port, 3121);
  assert.deepEqual(view.primaryShell?.verticalRefs, []);
  assert.deepEqual(view.verticals[0].verticalRefs, []);
  assert.equal(view.additionalShells[0].id, 'shell-admin');
  assert.equal(view.additionalShells[0].port, 3300);
  assert.deepEqual(view.additionalShells[0].verticalRefs, []);
  assert.deepEqual(
    view.apps.map(app => app.id),
    [shellApp.id, 'orders', 'shell-admin'],
  );
  assert.deepEqual(raw, before);
});

test('topology shell references fall back to compact refs only when absent', () => {
  const raw = inputs();
  const withoutRefs = { ...raw, topology: { ...raw.topology, shell: {} } };
  assert.deepEqual(
    normalizeWorkspaceInputs('/workspace', withoutRefs).primaryShell
      ?.verticalRefs,
    ['orders'],
  );
  assert.deepEqual(
    normalizeWorkspaceInputs('/workspace', raw).primaryShell?.verticalRefs,
    [],
  );
});

test('compact-only reads preserve current projections and apply live overlay ports', () => {
  const { config, overlay } = inputs();
  const compact = normalizeCompactUltramodernConfig('/workspace', config);
  assert.deepEqual(
    normalizeWorkspaceInputs('/workspace', { config }).apps,
    allWorkspaceAppsFromToolingConfig(compact),
  );
  const view = normalizeWorkspaceInputs('/workspace', { config, overlay });
  assert.equal(view.primaryShell?.port, 3120);
  assert.equal(view.verticals[0].port, 3121);
  // Additive shells have their own persisted configuration, outside strict topology.
  assert.equal(view.additionalShells[0].port, 3300);
  assert.deepEqual(view.primaryShell?.verticalRefs, ['orders']);
});

test('topology readers retain legacy fallbacks and additional shells outside topology', () => {
  const { config } = inputs();
  const view = normalizeWorkspaceInputs('/workspace', {
    config,
    topology: {
      verticals: [
        { id: 'legacy', moduleFederation: { remotes: [{ id: 'orders' }] } },
      ],
    },
  });
  assert.equal(view.primaryShell?.port, 3000);
  assert.equal(view.verticals[0].directory, 'verticals/legacy');
  assert.equal(view.verticals[0].port, 0);
  assert.deepEqual(view.verticals[0].verticalRefs, ['orders']);
  assert.equal(view.additionalShells[0].id, 'shell-admin');
});

test('disk read exposes raw fields and leaves the existing config reader compatible', () => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-normalization-'),
  );
  try {
    fs.mkdirSync(path.join(workspaceRoot, '.modernjs'));
    const raw = inputs();
    const configPath = path.join(workspaceRoot, '.modernjs/ultramodern.json');
    const bytes = `${JSON.stringify(raw.config)}\n`;
    fs.writeFileSync(configPath, bytes);
    const view = readUltramodernWorkspaceInputs(workspaceRoot, {
      topology: raw.topology,
      overlay: raw.overlay,
    });
    assert.deepEqual(view.raw.config, raw.config);
    assert.deepEqual(view.config, readUltramodernConfig(workspaceRoot));
    assert.equal(view.primaryShell?.port, 3120);
    assert.equal(fs.readFileSync(configPath, 'utf8'), bytes);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
