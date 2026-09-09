---
name: um-parallel-20260909-repair-build-cli-loading
overview: "Keep bin/run/register changes and app-tools rslib output in one worker because runtime loading depends on correctly emitted .mjs loaders and there must be a single writer for the build config. Audit upstream startup fixes without assuming they can be moved as new fork code."
todos:
  - id: repair-build-cli-loading-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-build-cli-loading-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-build-cli-loading-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: CLI startup, TypeScript loading and emitted loader artifacts

## Execution Notes

Tracking: `modernjs-cdhz.29.52`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Keep bin/run/register changes and app-tools rslib output in one worker because runtime loading depends on correctly emitted .mjs loaders and there must be a single writer for the build config. Audit upstream startup fixes without assuming they can be moved as new fork code.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/solutions/app-tools/bin/modern-bundle-docs.js`
- `packages/solutions/app-tools/bin/modern.js`
- `packages/solutions/app-tools/rslib.config.mts`
- `packages/solutions/app-tools/src/bundleDocs.ts`
- `packages/solutions/app-tools/src/run/index.ts`
- `packages/solutions/app-tools/src/utils/register.ts`
- `packages/solutions/app-tools/tests/initAppContext.test.ts`
- `packages/solutions/app-tools/tests/rslib-template-output.test.ts`
- `packages/solutions/app-tools/tests/utils/register-esm.test.ts`
- `packages/solutions/app-tools/tests/utils/register.test.ts`

Local seam prerequisites:

- Audit: none; independently calculate complete-PR deltas for register/run/bin/rslib identities and inspect native CLI loading seams.

- Writes: this shard's legal-route audit; toolkit server-tsconfig/alias resolver signature only if that call contract changes. Existing resolver behavior can be consumed without waiting for toolkit implementation.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/solutions/app-tools/bin/modern-bundle-docs.js`
- `packages/solutions/app-tools/bin/modern.js`
- `packages/solutions/app-tools/rslib.config.mts`
- `packages/solutions/app-tools/src/bundleDocs.ts`
- `packages/solutions/app-tools/src/run/index.ts`
- `packages/solutions/app-tools/src/utils/register.ts`
- `packages/solutions/app-tools/tests/initAppContext.test.ts`
- `packages/solutions/app-tools/tests/rslib-template-output.test.ts`
- `packages/solutions/app-tools/tests/utils/register-esm.test.ts`
- `packages/solutions/app-tools/tests/utils/register.test.ts`

Prospective destinations (not write grants):

- Prospective fork module packages/solutions/app-tools-extensions/src/cli-loading/ and tests/cli-loading/ for genuine fork-owned loader composition.

- Audited bin, run, register, bundleDocs and app-tools rslib identities keep upstream provenance; neutral fixes use upstream or demonstrably lawful capped edits.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- build-package-output receives app-tools emitted loader/declaration artifact paths and required output contract; that worker does not edit app-tools/rslib.config.mts.

- Toolkit owner receives required resolveServerTsconfig/alias behavior and exact shared-helper patch request; integrator owns scripts/prebundle changes if an output recipe needs shared updates.

- Integrator owns existing and prospective package.json manifests and public export maps; provide exact proposed patches without editing those files.

- Integrator owns pnpm-lock.yaml, release cohort/version metadata, FORK-DIVERGENCE.md and scripts/ultramodern-boundary-check/{divergence-allowlist.json,allowlist.json}; return per-identity evidence and required patches, never shared-file writes.

## Operator Guidance

Owner: `repair-build-cli-loading`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-build-cli-loading](um-parallel-20260909-audit-build-cli-loading.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Read-only audit may start immediately: regenerate owned identity/edge evidence against the selected integration head, fixed audited base eded841256a7cffdaa622e3889fc83407debd3e4 and actual complete PR merge range, including prior unmerged work. Classify fork additions versus audited identities; prove the native extension route or record the exact upstream blocker.

- After later implementation authorization, run focused existing behavior tests plus the listed real-output regressions, record deletion/move/retention and complete-PR/cumulative added-plus-removed line and hunk counts, and hand integration the evidence for the full canonical divergence/import gates. Moving an audited identity never resets its cap.

- Run register and register-esm, initAppContext, rslib-template-output and relevant CLI startup tests; build and execute actual CJS/ESM artifacts in type:module and CommonJS consumers with custom server tsconfig/aliases. Prove .mjs outputs have one producer and are never truncated; preserve createRequire bundling and native CLI startup.

Stop condition: All assigned startup/output identities have legal routes and real CJS/ESM loader proof. Oversized audited startup fixes wait on their specific upstream disposition; no generated-loader edits or app bootstrap shim substitutes for the owning-layer fix.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
