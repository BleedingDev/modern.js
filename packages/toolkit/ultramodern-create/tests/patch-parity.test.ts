import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from '@rstest/core';
import {
  checkPatchParity,
  cohortOwnedPatchFiles,
  formatPatchParityReport,
  readPatchedDependencies,
} from '../src/ultramodern-workspace/patch-parity';

const createPackageRoot = path.resolve(__dirname, '..');
const templatePatchDirectory = path.join(
  createPackageRoot,
  'template-workspace',
  'patches',
);

const withWorkspace = (
  build: (workspaceRoot: string) => void,
  run: (workspaceRoot: string) => void,
) => {
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'um-patch-parity-'),
  );
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'patches'), { recursive: true });
    build(workspaceRoot);
    run(workspaceRoot);
  } finally {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  }
};

const templatePatchFiles = () =>
  fs
    .readdirSync(templatePatchDirectory)
    .filter(entry => entry.endsWith('.patch'))
    .sort();

/** Copy every template patch and register each one, i.e. a healthy workspace. */
const seedInSync = (workspaceRoot: string) => {
  const registrations: string[] = ['patchedDependencies:'];
  for (const patchFile of templatePatchFiles()) {
    fs.copyFileSync(
      path.join(templatePatchDirectory, patchFile),
      path.join(workspaceRoot, 'patches', patchFile),
    );
    registrations.push(`  '${patchFile.replace(/\.patch$/u, '')}':`);
    registrations[registrations.length - 1] += ` patches/${patchFile}`;
  }
  fs.writeFileSync(
    path.join(workspaceRoot, 'pnpm-workspace.yaml'),
    `packages:\n  - 'apps/*'\n${registrations.join('\n')}\n`,
  );
};

describe('workspace patch parity', () => {
  test('the cohort owns the patches the policy lists', () => {
    const owned = cohortOwnedPatchFiles();

    expect(owned.length).toBeGreaterThan(0);
    expect(owned).toContain('@module-federation__modern-js-v3@2.9.0.patch');
    for (const patchFile of owned) {
      expect(patchFile.startsWith('patches/')).toBe(false);
    }
  });

  test('reads registered patch targets out of pnpm-workspace.yaml', () => {
    withWorkspace(seedInSync, workspaceRoot => {
      const registered = readPatchedDependencies(workspaceRoot);

      expect(Object.values(registered)).toContain(
        'patches/@module-federation__modern-js-v3@2.9.0.patch',
      );
    });
  });

  test('an in-sync workspace reports nothing', () => {
    withWorkspace(seedInSync, workspaceRoot => {
      expect(checkPatchParity({ workspaceRoot, createPackageRoot })).toEqual(
        [],
      );
    });
  });

  test('names a stale cohort-owned patch and the template to copy', () => {
    const stale = '@module-federation__modern-js-v3@2.9.0.patch';
    withWorkspace(
      workspaceRoot => {
        seedInSync(workspaceRoot);
        fs.writeFileSync(
          path.join(workspaceRoot, 'patches', stale),
          '--- a stale patch from a previous cohort\n',
        );
      },
      workspaceRoot => {
        const problems = checkPatchParity({ workspaceRoot, createPackageRoot });

        expect(problems.map(problem => problem.kind)).toContain('stale');
        const report = formatPatchParityReport(problems);
        expect(report).toContain(stale);
        expect(report).toContain(path.join(templatePatchDirectory, stale));
      },
    );
  });

  test('names a patch the workspace never copied', () => {
    const missing = '@module-federation__modern-js-v3@2.9.0.patch';
    withWorkspace(
      workspaceRoot => {
        seedInSync(workspaceRoot);
        fs.rmSync(path.join(workspaceRoot, 'patches', missing));
      },
      workspaceRoot => {
        const problems = checkPatchParity({ workspaceRoot, createPackageRoot });

        expect(
          problems.some(
            problem =>
              problem.kind === 'missing' && problem.patchFile === missing,
          ),
        ).toBe(true);
        expect(formatPatchParityReport(problems)).toContain(
          path.join(templatePatchDirectory, missing),
        );
      },
    );
  });

  test('names a patch that is present but never registered', () => {
    withWorkspace(
      workspaceRoot => {
        for (const patchFile of templatePatchFiles()) {
          fs.copyFileSync(
            path.join(templatePatchDirectory, patchFile),
            path.join(workspaceRoot, 'patches', patchFile),
          );
        }
        fs.writeFileSync(
          path.join(workspaceRoot, 'pnpm-workspace.yaml'),
          "packages:\n  - 'apps/*'\n",
        );
      },
      workspaceRoot => {
        const problems = checkPatchParity({ workspaceRoot, createPackageRoot });

        expect(problems.every(problem => problem.kind === 'unregistered')).toBe(
          true,
        );
        expect(formatPatchParityReport(problems)).toContain(
          'patchedDependencies',
        );
      },
    );
  });
});
