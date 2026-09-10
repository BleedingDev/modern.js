import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrateStrictEffect } from '../src/ultramodern-tooling/commands/migrate-strict-effect';
import {
  normalizeCompactConfig,
  UnsupportedUltramodernConfigError,
} from '../src/ultramodern-tooling/config';
import { runSyncDeliveryUnit } from '../src/ultramodern-workspace/delivery-unit-sync';
import { createWorkspace, snapshotWorkspace } from './helpers/workspace-kit';

const ultramodernConfigPath = '.modernjs/ultramodern.json';

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

const configRejectionCases = [
  {
    label: 'missing schemaVersion',
    mutate: (config: Record<string, any>) => {
      delete config.schemaVersion;
    },
    error:
      /schemaVersion is required.*Versionless v1 configs are not supported/,
    issue: { field: 'schemaVersion', value: undefined, reason: 'missing' },
  },
  {
    label: 'non-integer schemaVersion',
    mutate: (config: Record<string, any>) => {
      config.schemaVersion = 1.5;
    },
    error: /schemaVersion 1\.5.*must be the integer 1/,
    issue: { field: 'schemaVersion', value: 1.5, reason: 'non-integer' },
  },
  {
    label: 'string schemaVersion',
    mutate: (config: Record<string, any>) => {
      config.schemaVersion = '1';
    },
    error: /schemaVersion "1".*must be the integer 1/,
    issue: { field: 'schemaVersion', value: '1', reason: 'non-integer' },
  },
  {
    label: 'unsupported integer schemaVersion',
    mutate: (config: Record<string, any>) => {
      config.schemaVersion = 2;
    },
    error: /(Unsupported|Invalid) UltraModern config schemaVersion 2/,
    issue: { field: 'schemaVersion', value: 2, reason: 'unsupported' },
  },
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
];

test('normalization rejects each unsupported config shape at the schema boundary', () => {
  const { tempRoot, workspaceDir } = createWorkspace('strict-dispatch', {
    tempPrefix: 'um-strict-dispatch-',
  });

  try {
    const baseline = readJson(workspaceDir, ultramodernConfigPath);
    for (const rejection of configRejectionCases) {
      const config = structuredClone(baseline);
      rejection.mutate(config);
      assert.throws(
        () =>
          normalizeCompactConfig(
            workspaceDir,
            path.join(workspaceDir, ultramodernConfigPath),
            config,
          ),
        error => {
          const typedError = error as UnsupportedUltramodernConfigError;
          assert.equal(typedError.name, 'UnsupportedUltramodernConfigError');
          // Subset match: the issue may carry additional diagnostic fields
          // (e.g. reason) beyond the identity asserted here.
          for (const [key, value] of Object.entries(rejection.issue)) {
            assert.deepEqual(
              (typedError.issue as Record<string, unknown>)[key],
              value,
            );
          }
          assert.match(typedError.message, rejection.error);
          return true;
        },
        rejection.label,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('migrate-strict-effect rejects an unsupported config before writing', () => {
  const { tempRoot, workspaceDir } = createWorkspace('strict-dispatch', {
    tempPrefix: 'um-strict-dispatch-migrate-',
  });

  try {
    const config = readJson(workspaceDir, ultramodernConfigPath);
    config.schemaVersion = 2;
    writeJson(workspaceDir, ultramodernConfigPath, config);
    const before = snapshotWorkspace(workspaceDir);

    assert.throws(
      () =>
        runMigrateStrictEffect(['--skip-install'], {
          workspaceRoot: workspaceDir,
          invocationCwd: workspaceDir,
        }),
      (error: unknown) =>
        error instanceof UnsupportedUltramodernConfigError &&
        /schemaVersion 2/u.test(error.message),
    );
    assert.deepEqual(snapshotWorkspace(workspaceDir), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('sync-delivery-unit rejects a missing compact config before writing', () => {
  const { tempRoot, workspaceDir } = createWorkspace('strict-dispatch', {
    tempPrefix: 'um-strict-dispatch-sync-',
  });

  try {
    fs.rmSync(path.join(workspaceDir, ultramodernConfigPath));
    const before = snapshotWorkspace(workspaceDir);

    assert.throws(
      () =>
        runSyncDeliveryUnit([], {
          workspaceRoot: workspaceDir,
          invocationCwd: workspaceDir,
        }),
      /Missing \.modernjs\/ultramodern\.json/u,
    );
    assert.deepEqual(snapshotWorkspace(workspaceDir), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
