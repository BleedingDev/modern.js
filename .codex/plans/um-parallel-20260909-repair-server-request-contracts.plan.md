---
name: um-parallel-20260909-repair-server-request-contracts
overview: "Repair server action, request configuration, telemetry contracts and safe-failure imports while preserving native request handling and runtime identity."
todos:
  - id: repair-server-request-contracts-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-server-request-contracts-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-server-request-contracts-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Request contracts, server actions and safe-failure ownership

## Execution Notes

Tracking: `modernjs-cdhz.29.32`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Repair server action, request configuration, telemetry contracts and safe-failure imports while preserving native request handling and runtime identity.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/server/core/src/plugins/render/serverActionHandler.ts`
- `packages/server/core/src/types/config/bffRuntime.ts`
- `packages/server/core/src/types/config/serverTelemetry.ts`
- `packages/server/core/src/utils/error.ts`
- `packages/server/core/tests/context.test.ts`
- `packages/server/core/tests/plugins/dataHandler.test.ts`
- `packages/server/core/tests/plugins/serverActionHandler.test.ts`
- `packages/server/core/tests/utils/error.test.ts`
- `packages/server/core/tsconfig.json`

Local seam prerequisites:

- Route audit can begin immediately from the recorded inventory; reconcile assigned identities and imports with the baseline lane at the chosen integration head before writes.

- Writes require only this shard’s evidence-backed legal ownership route and frozen native interface from ownership-contract; no dependency on completion of unrelated server shards.

- For an unavailable native seam, prepare a neutral upstream proposal through upstream-patches. Development against an exact prepared proposal is conditional; actual upstream acceptance and provenance carry-forward remain integration/release prerequisites.

- Freeze native error propagation/server-action hook, configuration type ownership and request context contracts with runtime-ssr, bff and toolkit owners. These interface handshakes gate only their dependent writes; independent identity audits start immediately.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/server/core/src/plugins/render/serverActionHandler.ts`
- `packages/server/core/src/types/config/bffRuntime.ts`
- `packages/server/core/src/types/config/serverTelemetry.ts`
- `packages/server/core/src/utils/error.ts`
- `packages/server/core/tests/context.test.ts`
- `packages/server/core/tests/plugins/dataHandler.test.ts`
- `packages/server/core/tests/plugins/serverActionHandler.test.ts`
- `packages/server/core/tests/utils/error.test.ts`
- `packages/server/core/tsconfig.json`

Prospective destinations (not write grants):

- Prospective exclusive fork submodules: packages/server/runtime-extensions/src/request-contracts/ (bffRuntime.ts and serverTelemetry.ts), packages/server/runtime-extensions/src/request-safety/ (native plugin adapter only), and packages/server/runtime-extensions/tests/request-safety/.

- Reuse the existing canonical runtime safe-failure owner via a neutral native error/request hook; do not duplicate its implementation or add a fork import to core. Assigned audited core error.ts, serverActionHandler.ts, error.test.ts and core/tsconfig.json retain their legal-route constraints.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packaging is the single writer for shared package.json manifests/exports, rslib entry configuration, pnpm-lock.yaml and release cohort data; supply exact patches without editing them.

- ownership-contract/integration is the single writer for FORK-DIVERGENCE.md and canonical divergence/import allowance records; provide identity, complete-PR delta and disposition evidence. No reset, scope narrowing or hidden governed import.

- runtime-ssr owns the canonical safe-failure runtime implementation; coordinate the hook payload/API identity and deliver any changes outside this reservation to that owner.

- bff owns BFF capability semantics and toolkit owns shared contracts; provide exact bffRuntime/serverTelemetry type relocation interfaces and caller handoffs.

- Existing packages/server/runtime-extensions/src/telemetry/plugin.ts and telemetryCore.ts are shared integration surfaces: provide exact contract-consumption changes to their designated single owner; this shard reserves no telemetry directory.

- packaging owns packages/server/runtime-extensions/src/index.ts and package type exports; lifecycle consumes request plugin descriptors for final composition.

## Operator Guidance

Owner: `repair-server-request-contracts`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-server-request-contracts](um-parallel-20260909-audit-server-request-contracts.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Regenerate complete canonical divergence and import evidence; demonstrate removal of every assigned violation/edge, including active allowlisted edges, without weakening checks.

- Report old-to-new identity/deletion/retention map and complete eventual PR added-plus-removed lines for every audited identity, including PR49 and later edits; audited identities stay governed across renames and retain the 20-line cap.

- Run focused existing component suites and behavior regressions against actual outputs; preserve meaningful coverage when relocating fork-created tests. Same-PR ledger required for accepted non-shrink audited changes.

- Verify server actions, data handlers, request context and safe-failure positive/negative paths; preserve security headers and native failure behavior on Node and workerd. Type-check real contract consumers after owner handoffs.

Stop condition: Stop writes on an unproved legal route, over-cap audited repair, or unresolved required native interface and return that exact blocked identity/seam to its owner; unrelated route audits and legally released shards continue. Finish only with every assigned identity accounted for and component proof complete; required upstream landing cannot be claimed from proposal-only evidence.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
