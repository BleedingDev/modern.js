import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
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
  assert.deepEqual(raw, before);
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
