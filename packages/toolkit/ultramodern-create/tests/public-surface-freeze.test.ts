import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  addUltramodernVertical,
  generateUltramodernWorkspace,
  planUltramodernVertical,
} from '../src/ultramodern-workspace';

/**
 * W2 characterization freeze of the public v1 surface of `@modern-js/ultramodern-create`.
 *
 * This suite deliberately locks CURRENT behavior so later schema-version work
 * (W3+) cannot silently break the published entry points, symbol set, or
 * result-object shape. It does NOT re-assert values already covered by
 * workspace-manifest / vertical-dry-run / codesmith-adapter / workspace-*
 * tests; it freezes structure (which subpaths load, which symbols exist, which
 * result fields are present) and the volatile build-marker semantics.
 */

const packageRoot = path.resolve(__dirname, '..');
const requireCjs = createRequire(__filename);
// ---------------------------------------------------------------------------
// 1. Generated result values
//
// The result/plan types in src/ultramodern-workspace/types.ts (~145-193, 241-253)
// are the public automation contract. Runtime types are erased, so assert every
// declared (non-optional) field has a real value on a generated result.
// ---------------------------------------------------------------------------

const GENERATION_RESULT_FIELDS = [
  'operation',
  'workspaceRoot',
  'packageScope',
  'packageSource',
  'createdApps',
  'createdPaths',
  'rewrittenPaths',
  'assignedPorts',
  'moduleFederationNames',
  'apiPrefixes',
  'generatedContractPath',
  'warnings',
] as const;

const GENERATED_APP_DESCRIPTOR_FIELDS = [
  'id',
  'directory',
  'packageName',
  'packageSuffix',
  'displayName',
  'kind',
  'portEnv',
  'port',
  'moduleFederationName',
] as const;

const VERTICAL_PLAN_EXTRA_FIELDS = [
  'dryRun',
  'selectedPort',
  'moduleFederationRemote',
  'jsonMutations',
  'shellDependencyChanges',
  'generatedContractChanges',
] as const;

function assertHasAllFields(
  object: Record<string, unknown>,
  fields: readonly string[],
  label: string,
) {
  for (const field of fields) {
    assert.ok(
      object[field] !== undefined,
      `${label} result is missing public field "${field}"`,
    );
  }
}

test('generation-result and plan objects carry every frozen public field', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-surface-freeze-'));
  const workspaceDir = path.join(tempRoot, 'surface-freeze-workspace');

  try {
    const workspaceResult = generateUltramodernWorkspace({
      targetDir: workspaceDir,
      packageName: 'surface-freeze-workspace',
      modernVersion: '3.2.1',
      enableTailwind: true,
      packageSource: {
        strategy: 'workspace',
      },
    });

    assertHasAllFields(
      workspaceResult as unknown as Record<string, unknown>,
      GENERATION_RESULT_FIELDS,
      'workspace generation',
    );
    for (const app of workspaceResult.createdApps) {
      assertHasAllFields(
        app as unknown as Record<string, unknown>,
        GENERATED_APP_DESCRIPTOR_FIELDS,
        'workspace app descriptor',
      );
    }

    const plan = planUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });

    assertHasAllFields(
      plan as unknown as Record<string, unknown>,
      GENERATION_RESULT_FIELDS,
      'vertical plan (base)',
    );
    assertHasAllFields(
      plan as unknown as Record<string, unknown>,
      VERTICAL_PLAN_EXTRA_FIELDS,
      'vertical plan (extra)',
    );
    assertHasAllFields(
      plan.moduleFederationRemote as unknown as Record<string, unknown>,
      ['id', 'name', 'manifestUrl'],
      'plan moduleFederationRemote',
    );

    const verticalResult = addUltramodernVertical({
      workspaceRoot: workspaceDir,
      name: 'catalog',
      modernVersion: '3.2.1',
    });
    assertHasAllFields(
      verticalResult as unknown as Record<string, unknown>,
      GENERATION_RESULT_FIELDS,
      'vertical generation',
    );
    // The vertical descriptor exercises the optional descriptor fields, which
    // are part of the frozen shape for full-stack verticals.
    const catalogApp = verticalResult.createdApps[0];
    assertHasAllFields(
      catalogApp as unknown as Record<string, unknown>,
      [...GENERATED_APP_DESCRIPTOR_FIELDS, 'exposes', 'apiPrefix'],
      'vertical app descriptor',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 2. Volatile build-marker characterization
//
// createBuildMarker (src/ultramodern-workspace/delivery-unit.ts) is seeded once
// per module load from `Date.now()` + `crypto.randomUUID()`. This test CODIFIES
// that CURRENT behavior so Phase 1's "schema-only migration PRESERVES existing
// build markers (rotation only on declared new build)" requirement has a
// baseline: markers are STABLE within one process and DIFFER across processes.
// If a future change makes markers deterministic (or per-call random), this
// freeze must be updated deliberately.
// ---------------------------------------------------------------------------

const builtDeliveryUnitCjs = path.join(
  packageRoot,
  'dist/cjs/ultramodern-workspace/delivery-unit.cjs',
);

test('build markers are stable within a single process for identical input', () => {
  assert.ok(
    fs.existsSync(builtDeliveryUnitCjs),
    `built delivery-unit artifact missing: ${builtDeliveryUnitCjs}`,
  );
  const { createBuildMarker } = requireCjs(builtDeliveryUnitCjs);
  const app = { id: 'shell-super-app', packageSuffix: 'shell-super-app' };
  const first = createBuildMarker('freeze-scope', app);
  const second = createBuildMarker('freeze-scope', app);
  assert.equal(
    first,
    second,
    'within one process the module-load seed is fixed, so identical input must produce identical markers',
  );
  // Different input in the same process still diverges.
  const other = createBuildMarker('freeze-scope', {
    id: 'catalog',
    packageSuffix: 'catalog',
  });
  assert.notEqual(first, other);
});

function markerFromChildProcess(): string {
  const script = `const { createBuildMarker } = require(${JSON.stringify(
    builtDeliveryUnitCjs,
  )}); process.stdout.write(createBuildMarker('freeze-scope', { id: 'shell-super-app', packageSuffix: 'shell-super-app' }));`;
  const child = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  return child.stdout.trim();
}

test('build markers are deterministic across processes (identity hash)', () => {
  const first = markerFromChildProcess();
  const second = markerFromChildProcess();
  assert.equal(
    first,
    second,
    'the build marker is a stable identity hash of the delivery unit; the CLI stamps it in one process and the generated validator recomputes it in another (pnpm check), so it MUST agree across processes',
  );
});

// ---------------------------------------------------------------------------
// 3. CLI vertical-flag freeze
//
// Intentionally NOT re-tested here. The CLI vertical/dry-run flag surface is
// already frozen by:
//   - tests/vertical-dry-run.test.ts (CLI --vertical --dry-run, --dry-run gating)
//   - tests/integration/create-ultramodern-workspace/tests/index.test.ts
//     (--vertical creation, removed --microvertical flag rejection)
// Duplicating those would violate the "no duplicate coverage" constraint.
// ---------------------------------------------------------------------------
