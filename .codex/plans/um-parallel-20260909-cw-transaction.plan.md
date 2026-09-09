---
name: um-parallel-20260909-cw-transaction
overview: "Own all updater orchestration, MigrationIo, installation and consumer cohort edits. Select same-contract path from versioned evidence; limit its write set to dependency fields, package-manager lock and frozen narrow release identity data. Integrate legacy leaf handoffs without transferring orchestrator ownership."
todos:
  - id: cw-transaction-deliver
    content: "Own all updater orchestration, MigrationIo, installation and consumer cohort edits. Select same-contract path from versioned evidence; limit its write set to dependency fields, package-manager lock and frozen narrow release identity data. Integrate legacy leaf handoffs without transferring orchestrator ownership."
    status: pending
  - id: cw-transaction-prove
    content: "Produce and verify: Existing public command with structured dry-run/change/preserve/conflict behavior, complete atomic stage/check/install/promote/rollback and interrupted retry; repeat application no-op. Consumer TS/JS, deployment config, topology, scripts, patches and compatible newer package manager settings remain byte-for-byte unchanged for same-contract success."
    status: pending
isProject: false
---

# Implement same-contract updates and atomic existing transaction behavior

## Execution Notes

Tracking: `modernjs-cdhz.29.92`. Mode: **source implementation behind frozen contract; runs beside generator and legacy leaves when APIs already exist**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Own all updater orchestration, MigrationIo, installation and consumer cohort edits. Select same-contract path from versioned evidence; limit its write set to dependency fields, package-manager lock and frozen narrow release identity data. Integrate legacy leaf handoffs without transferring orchestrator ownership.

Required output: Existing public command with structured dry-run/change/preserve/conflict behavior, complete atomic stage/check/install/promote/rollback and interrupted retry; repeat application no-op. Consumer TS/JS, deployment config, topology, scripts, patches and compatible newer package manager settings remain byte-for-byte unchanged for same-contract success.

External prerequisites:

- external fact: any new generator identity reader invoked by this patch has actually been delivered by cw-generator; independent transaction safety edits need only the frozen existing MigrationIo interface

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/io.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/install.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/package-cohort.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/package-source.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/same-contract.ts`
- `packages/toolkit/ultramodern-create/tests/migrate-dependency-cohort.test.ts`
- `packages/toolkit/ultramodern-create/tests/migrate-idempotence.test.ts`
- `packages/toolkit/ultramodern-create/tests/migrate-io-security.test.ts`

Out of scope: No hand-edited repository lockfile, generator/catalog/template writes, independent second updater or legacy transformation edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `cw-transaction`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [cw-update-contract](um-parallel-20260909-cw-update-contract.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: Meaningful unit/injection proofs for every mutation boundary, install/check failure and interruption; snapshot bytes/modes/symlinks, Git metadata and index before/after; no shared mutable test roots. Real tarball proof remains downstream.

Stop condition: Any same-contract source/config diff or incomplete rollback is a defect; do not relabel it as migration or accept manual repair.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
