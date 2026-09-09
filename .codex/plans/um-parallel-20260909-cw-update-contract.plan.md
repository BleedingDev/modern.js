---
name: um-parallel-20260909-cw-update-contract
overview: "Define versioned same-contract versus breaking-schema/API classification, exact dependency/lock/narrow-identity allowlist, structured change/preserve/conflict result and existing MigrationIo staging/promotion semantics. Freeze a stable leaf transformation interface so transaction and legacy source owners can work independently."
todos:
  - id: cw-update-contract-deliver
    content: "Define versioned same-contract versus breaking-schema/API classification, exact dependency/lock/narrow-identity allowlist, structured change/preserve/conflict result and existing MigrationIo staging/promotion semantics. Freeze a stable leaf transformation interface so transaction and legacy source owners can work independently."
    status: pending
  - id: cw-update-contract-prove
    content: "Produce and verify: Reviewable schema and signatures for existing CLI/transaction/leaf boundaries, no second transaction engine. Include installation/check failure, interruption/retry, Git/index/symlink snapshot rules and distinct analyzer/runtime/ownership/network errors; reserve orchestrator writes exclusively to cw-transaction."
    status: pending
isProject: false
---

# Freeze update classification and transaction handoff contracts

## Execution Notes

Tracking: `modernjs-cdhz.29.90`. Mode: **read-only contract design after bounded evidence inputs**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Define versioned same-contract versus breaking-schema/API classification, exact dependency/lock/narrow-identity allowlist, structured change/preserve/conflict result and existing MigrationIo staging/promotion semantics. Freeze a stable leaf transformation interface so transaction and legacy source owners can work independently.

Required output: Reviewable schema and signatures for existing CLI/transaction/leaf boundaries, no second transaction engine. Include installation/check failure, interruption/retry, Git/index/symlink snapshot rules and distinct analyzer/runtime/ownership/network errors; reserve orchestrator writes exclusively to cw-transaction.

Read-only input identities:

- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/io.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/install.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/api-artifact-migration.ts`

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Out of scope: No CLI alias, doctor/governance system, broad application reconstruction or source implementation.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `cw-update-contract`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [cw-journeys](um-parallel-20260909-cw-journeys.plan.md), [cw-artifact-contract](um-parallel-20260909-cw-artifact-contract.plan.md), [cw-historical-fixtures](um-parallel-20260909-cw-historical-fixtures.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: Walk success, no-op, dry-run, preflight conflict, validation failure, install failure and interrupt states against byte-preservation requirements. Record which source APIs are already usable and which require generator/package handoff.

Stop condition: A mere proposed signature cannot authorize source that calls an absent package API. Any unresolved prerequisite names the exact symbol/provider and blocks only the dependent edit.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
