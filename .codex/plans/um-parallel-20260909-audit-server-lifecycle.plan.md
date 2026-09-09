---
name: um-parallel-20260909-audit-server-lifecycle
overview: "Remove the four lifecycle/assembly governed edges through native plugin registration and preserve startup, draining, reload, cleanup and shutdown semantics."
todos:
  - id: audit-server-lifecycle-reconcile
    content: "Reconcile every reserved identity and current import against the pinned execution inventory; prove audited/fork ownership, callers and complete-PR capacity without changing source."
    status: pending
  - id: audit-server-lifecycle-route
    content: "Prove a behavior-preserving lawful route and only the native interfaces this shard consumes. Prepare a bounded seam packet for unresolved upstream needs; do not treat an unknown route as approved."
    status: pending
  - id: audit-server-lifecycle-grant
    content: "Obtain the integration owner’s exact source/destination reservation and accepted peer interface contracts. Release only this shard when all write prerequisites are real; unresolved rows remain blocked and are registered with explicit dependency edges."
    status: pending
isProject: false
---

# Audit: Production and development lifecycle assembly

## Execution Notes

Tracking: `modernjs-cdhz.29.33`. Mode: **read-only**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Remove the four lifecycle/assembly governed edges through native plugin registration and preserve startup, draining, reload, cleanup and shutdown semantics.

Required output: Per-identity legal route, caller/seam evidence, complete-PR capacity and one exact source/destination ownership packet for server-lifecycle.

Read-only input identities:

- `packages/server/plugin-polyfill/tsconfig.json`
- `packages/server/prod-server/src/apply.ts`
- `packages/server/prod-server/src/index.ts`
- `packages/server/prod-server/tests/applyPlugins.test.ts`
- `packages/server/prod-server/tests/backendFederationAssets.test.ts`
- `packages/server/prod-server/tests/runtimeLifecycle.test.ts`
- `packages/server/server-runtime/tsconfig.json`
- `packages/server/server/src/createDevServer.ts`
- `packages/server/server/src/dev-tools/reloadManager.ts`
- `packages/server/server/tests/reloadManager.test.ts`
- `packages/server/server/tsconfig.json`

Local seam prerequisites:

- Route audit can begin immediately from the recorded inventory; reconcile assigned identities and imports with the baseline lane at the chosen integration head before writes.

- Writes require only this shard’s evidence-backed legal ownership route and frozen native interface from ownership-contract; no dependency on completion of unrelated server shards.

- For an unavailable native seam, prepare a neutral upstream proposal through upstream-patches. Development against an exact prepared proposal is conditional; actual upstream acceptance and provenance carry-forward remain integration/release prerequisites.

- Freeze native ServerPlugin lifecycle events and cleanup ownership with ownership-contract and the build lane’s fork preset owner, covering production/dev registration, failed startup, reload, draining and disposal.

- Final composition requires server-static and server-request-contracts plugin descriptors only where their registrations are actually consumed; lifecycle route audit and standalone lifecycle implementation do not wait for those shard completions.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Prospective destinations (not write grants):

- Exclusive existing implementation target after route approval: packages/server/runtime-extensions/src/runtimeLifecycle.ts; prospective local native lifecycle plugin at packages/server/runtime-extensions/src/lifecycle/plugin.ts.

- Exclusive existing focused test target: packages/server/runtime-extensions/tests/runtimeLifecycle.test.ts; prospective relocated assembly/reload tests under packages/server/runtime-extensions/tests/lifecycle/.

- Assigned upstream production/dev assembly and reload identities stay capped or follow a genuine upstream route; fork preset registration is a cross-lane handoff, never explicit upstream-to-fork plugin loading.

Out of scope: Source changes, shared manifests/lockfile/ledger/allowlists, upstream submission and other shards.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packaging is the single writer for shared package.json manifests/exports, rslib entry configuration, pnpm-lock.yaml and release cohort data; supply exact patches without editing them.

- ownership-contract/integration is the single writer for FORK-DIVERGENCE.md and canonical divergence/import allowance records; provide identity, complete-PR delta and disposition evidence. No reset, scope narrowing or hidden governed import.

- build lane’s fork preset owner registers server extensions through native upstream interfaces; provide exact descriptor, order and lifecycle integration patches rather than editing build-owned preset files.

- packaging is the single owner of packages/server/runtime-extensions/src/index.ts registration aggregation and shared export maps. Supply descriptors from this shard and consume static/request shard handoffs there.

- bff owns backend federation asset/security behavior; preserve its interface in backendFederationAssets tests and hand off changes to bff-owned implementation.

- The assigned package tsconfig files are exclusive to this shard; hand off any root TypeScript config, manifest or shared test-config edits to their integration owners.

## Operator Guidance

Owner: `audit-server-lifecycle`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-baseline-freeze](um-parallel-20260909-gate-baseline-freeze.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Regenerate complete canonical divergence and import evidence; demonstrate removal of every assigned violation/edge, including active allowlisted edges, without weakening checks.

- Report old-to-new identity/deletion/retention map and complete eventual PR added-plus-removed lines for every audited identity, including PR49 and later edits; audited identities stay governed across renames and retain the 20-line cap.

- Run focused existing component suites and behavior regressions against actual outputs; preserve meaningful coverage when relocating fork-created tests. Same-PR ledger required for accepted non-shrink audited changes.

- Run production applyPlugins/backendFederationAssets/runtimeLifecycle and dev reload suites plus extension lifecycle tests. Exercise Node ESM startup, startup failure cleanup, in-flight request draining, repeated disposal and shutdown ordering; verify workerd excludes Node lifecycle dependencies.

Stop condition: Stop writes on an unproved legal route, over-cap audited repair, or unresolved required native interface and return that exact blocked identity/seam to its owner; unrelated route audits and legally released shards continue. Finish only with every assigned identity accounted for and component proof complete; required upstream landing cannot be claimed from proposal-only evidence.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
