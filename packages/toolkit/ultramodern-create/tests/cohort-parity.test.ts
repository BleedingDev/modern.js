import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from '@rstest/core';
import {
  checkReleaseCohortParity,
  formatReleaseCohortParityReport,
  jsonDifferences,
} from '../src/ultramodern-workspace/cohort-parity';

const projection = (overrides: Record<string, unknown> = {}) => ({
  schema: 'ultramodern-release-cohort-projection',
  schemaVersion: 1,
  release: { version: '3.9.0-ultramodern.9' },
  source: { commit: '40bd94bfc127ebc46180eb07684c82c26fedee62' },
  packages: [
    { sourceName: '@modern-js/app-tools', version: '3.9.0-ultramodern.9' },
  ],
  ...overrides,
});

const withRoots = (
  build: (roots: { workspaceRoot: string; createPackageRoot: string }) => void,
  run: (roots: { workspaceRoot: string; createPackageRoot: string }) => void,
) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'um-cohort-parity-'));
  const roots = {
    workspaceRoot: path.join(base, 'workspace'),
    createPackageRoot: path.join(base, 'create'),
  };
  try {
    fs.mkdirSync(path.join(roots.workspaceRoot, '.modernjs'), {
      recursive: true,
    });
    fs.mkdirSync(
      path.join(roots.createPackageRoot, 'template-workspace', '.modernjs'),
      { recursive: true },
    );
    build(roots);
    run(roots);
  } finally {
    fs.rmSync(base, { force: true, recursive: true });
  }
};

const writeTemplate = (createPackageRoot: string, value: unknown) =>
  fs.writeFileSync(
    path.join(
      createPackageRoot,
      'template-workspace',
      '.modernjs',
      'release-cohort.json',
    ),
    `${JSON.stringify(value, null, 2)}\n`,
  );

const writeWorkspace = (workspaceRoot: string, value: unknown) =>
  fs.writeFileSync(
    path.join(workspaceRoot, '.modernjs', 'release-cohort.json'),
    // Formatting is not the contract; the content is.
    JSON.stringify(value),
  );

describe('release cohort projection parity', () => {
  test('a projection equal to the template reports nothing', () => {
    withRoots(
      ({ workspaceRoot, createPackageRoot }) => {
        writeTemplate(createPackageRoot, projection());
        writeWorkspace(workspaceRoot, projection());
      },
      roots => {
        expect(
          checkReleaseCohortParity({ ...roots, requireTemplate: true }),
        ).toBeUndefined();
      },
    );
  });

  test('a version-only adoption that kept the previous source commit is named', () => {
    // What happened on the .9 adoptions: every version string was bumped,
    // the previous cohort's source.commit stayed behind.
    withRoots(
      ({ workspaceRoot, createPackageRoot }) => {
        writeTemplate(createPackageRoot, projection());
        writeWorkspace(
          workspaceRoot,
          projection({
            source: { commit: '905cd7ae5b0f74460f00e2e0c11625c5a2662b0f' },
          }),
        );
      },
      roots => {
        const problem = checkReleaseCohortParity({
          ...roots,
          requireTemplate: true,
        });
        expect(problem?.differences).toEqual(['source.commit']);
        expect(problem?.message).toContain('differs at source.commit');
        expect(problem?.message).toContain(
          path.join(
            roots.createPackageRoot,
            'template-workspace',
            '.modernjs',
            'release-cohort.json',
          ),
        );
        expect(formatReleaseCohortParityReport(problem!)).toContain(
          'release cohort projection is out of step',
        );
      },
    );
  });

  test('a local-source workspace without a template projection judges nothing', () => {
    withRoots(
      ({ workspaceRoot }) => {
        writeWorkspace(workspaceRoot, projection());
      },
      roots => {
        expect(
          checkReleaseCohortParity({ ...roots, requireTemplate: false }),
        ).toBeUndefined();
      },
    );
  });

  test('an installed cohort whose projection is missing or unreadable fails closed', () => {
    // The gate authenticates provenance; a template it cannot read must not
    // silently disable it.
    withRoots(
      ({ workspaceRoot }) => {
        writeWorkspace(workspaceRoot, projection());
      },
      roots => {
        const problem = checkReleaseCohortParity({
          ...roots,
          requireTemplate: true,
        });
        expect(problem?.message).toContain(
          'ships no release cohort projection',
        );
        expect(problem?.message).toContain('Reinstall the published cohort');
      },
    );
    withRoots(
      ({ workspaceRoot, createPackageRoot }) => {
        fs.writeFileSync(
          path.join(
            createPackageRoot,
            'template-workspace',
            '.modernjs',
            'release-cohort.json',
          ),
          '{ not json',
        );
        writeWorkspace(workspaceRoot, projection());
      },
      roots => {
        expect(
          checkReleaseCohortParity({ ...roots, requireTemplate: true })
            ?.message,
        ).toContain('ships an unreadable release cohort projection');
      },
    );
  });

  test('an unreadable workspace projection is reported as different', () => {
    withRoots(
      ({ workspaceRoot, createPackageRoot }) => {
        writeTemplate(createPackageRoot, projection());
        fs.writeFileSync(
          path.join(workspaceRoot, '.modernjs', 'release-cohort.json'),
          '{ not json',
        );
      },
      roots => {
        const problem = checkReleaseCohortParity({
          ...roots,
          requireTemplate: true,
        });
        expect(problem?.differences.length).toBeGreaterThan(0);
        expect(problem?.message).toContain('Replace it with');
      },
    );
  });

  test('json differences name nested paths and array shape', () => {
    expect(
      jsonDifferences(
        { a: { b: 1, c: [1, 2] }, d: 'x' },
        { a: { b: 2, c: [1, 3] }, d: 'x' },
      ),
    ).toEqual(['a.b', 'a.c[1]']);
    expect(jsonDifferences({ p: [1] }, { p: [1, 2] })).toEqual(['p.length']);
  });
});
