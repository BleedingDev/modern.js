---
name: um-parallel-20260909-audit-server-compiler
overview: "Repair compiler and TypeScript resolution ownership as one cohesive worker, retaining native ESM/CJS emission and tsgo cleanup without splitting tightly coupled compiler files across writers."
todos:
  - id: audit-server-compiler-reconcile
    content: "Reconcile every reserved identity and current import against the pinned execution inventory; prove audited/fork ownership, callers and complete-PR capacity without changing source."
    status: pending
  - id: audit-server-compiler-route
    content: "Prove a behavior-preserving lawful route and only the native interfaces this shard consumes. Prepare a bounded seam packet for unresolved upstream needs; do not treat an unknown route as approved."
    status: pending
  - id: audit-server-compiler-grant
    content: "Obtain the integration owner’s exact source/destination reservation and accepted peer interface contracts. Release only this shard when all write prerequisites are real; unresolved rows remain blocked and are registered with explicit dependency edges."
    status: pending
isProject: false
---

# Audit: Server compiler, import rewriting and emitted module behavior

## Execution Notes

Tracking: `modernjs-cdhz.29.35`. Mode: **read-only**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Repair compiler and TypeScript resolution ownership as one cohesive worker, retaining native ESM/CJS emission and tsgo cleanup without splitting tightly coupled compiler files across writers.

Required output: Per-identity legal route, caller/seam evidence, complete-PR capacity and one exact source/destination ownership packet for server-compiler.

Read-only input identities:

- `packages/server/utils/src/compilers/typescript/importRewriter.ts`
- `packages/server/utils/src/compilers/typescript/index.ts`
- `packages/server/utils/src/compilers/typescript/tsconfigPathsPlugin.ts`
- `packages/server/utils/tests/fixtures/ts-example/nested/tsconfig.json`
- `packages/server/utils/tests/fixtures/ts-example/tsconfig.bundler.json`
- `packages/server/utils/tests/fixtures/ts-example/tsconfig.noemit.json`
- `packages/server/utils/tests/fixtures/tsx-example/server/helper.mjs`
- `packages/server/utils/tests/fixtures/tsx-example/server/native.cts`
- `packages/server/utils/tests/fixtures/tsx-example/server/native.mts`
- `packages/server/utils/tests/importRewriter.test.ts`
- `packages/server/utils/tests/rewriteOutput.test.ts`
- `packages/server/utils/tests/ts.test.ts`
- `packages/server/utils/tests/tsgo.test.ts`
- `packages/server/utils/tests/tsgoCleanup.test.ts`
- `packages/server/utils/tsconfig.json`

Local seam prerequisites:

- Route audit can begin immediately from the recorded inventory; reconcile assigned identities and imports with the baseline lane at the chosen integration head before writes.

- Writes require only this shard’s evidence-backed legal ownership route and frozen native interface from ownership-contract; no dependency on completion of unrelated server shards.

- For an unavailable native seam, prepare a neutral upstream proposal through upstream-patches. Development against an exact prepared proposal is conditional; actual upstream acceptance and provenance carry-forward remain integration/release prerequisites.

- Freeze compiler invocation/resolution and output rewrite contracts with the build/toolkit owners. Existing native extension availability must be demonstrated; if absent, prepare a neutral upstream compiler seam and retain actual landing as a release dependency.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Prospective destinations (not write grants):

- Prospective dedicated fork-owned package submodule: packages/server/compiler-extensions/src/typescript/ for genuinely additive compiler/import-rewriter behavior; tests and fixtures under packages/server/compiler-extensions/tests/typescript/. Package existence/name and native compiler seam must be resolved during this shard’s route audit.

- Do not move audited compiler index.ts, tsconfigPathsPlugin.ts, ts.test.ts or helper.mjs and call them fork-owned. Their legal restoration/extension/upstream route is separate evidence; existing fork additions may move into the dedicated package only after route approval.

- No reservation over server/runtime-extensions or general toolkit directories; keep compiler dependencies out of runtime/workerd entrypoints.

Out of scope: Source changes, shared manifests/lockfile/ledger/allowlists, upstream submission and other shards.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packaging is the single writer for shared package.json manifests/exports, rslib entry configuration, pnpm-lock.yaml and release cohort data; supply exact patches without editing them.

- ownership-contract/integration is the single writer for FORK-DIVERGENCE.md and canonical divergence/import allowance records; provide identity, complete-PR delta and disposition evidence. No reset, scope narrowing or hidden governed import.

- build/toolkit compiler callers and shared compiler contracts stay with their respective owners; provide exact native invocation and emitted-output interface patches.

- packaging owns prospective packages/server/compiler-extensions/package.json, exports, package build/test registration and fixture manifests. This shard supplies compiler-local source/tests and the exact packaging request.

## Operator Guidance

Owner: `audit-server-compiler`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-baseline-freeze](um-parallel-20260909-gate-baseline-freeze.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Regenerate complete canonical divergence and import evidence; demonstrate removal of every assigned violation/edge, including active allowlisted edges, without weakening checks.

- Report old-to-new identity/deletion/retention map and complete eventual PR added-plus-removed lines for every audited identity, including PR49 and later edits; audited identities stay governed across renames and retain the 20-line cap.

- Run focused existing component suites and behavior regressions against actual outputs; preserve meaningful coverage when relocating fork-created tests. Same-PR ledger required for accepted non-shrink audited changes.

- Run importRewriter, rewriteOutput, ts, tsgo and tsgoCleanup suites; verify actual emitted Node ESM/CJS (.mts/.cts/.mjs), bundler/noEmit/nested tsconfig behavior and cleanup after failed compilation. Check real Node loading and workerd-compatible outputs without app shims.

Stop condition: Stop writes on an unproved legal route, over-cap audited repair, or unresolved required native interface and return that exact blocked identity/seam to its owner; unrelated route audits and legally released shards continue. Finish only with every assigned identity accounted for and component proof complete; required upstream landing cannot be claimed from proposal-only evidence.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
