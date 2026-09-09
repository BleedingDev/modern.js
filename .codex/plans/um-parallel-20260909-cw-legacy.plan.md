---
name: um-parallel-20260909-cw-legacy
overview: "Reuse historical recognizers and scope guards for each proven supported schema/API transition. Replace recognized owned code with native imports; preserve authored source and reject unknown/custom baselines before promotion. Provide leaf invocation patches to cw-transaction, never edit its orchestrator."
todos:
  - id: cw-legacy-deliver
    content: "Reuse historical recognizers and scope guards for each proven supported schema/API transition. Replace recognized owned code with native imports; preserve authored source and reject unknown/custom baselines before promotion. Provide leaf invocation patches to cw-transaction, never edit its orchestrator."
    status: pending
  - id: cw-legacy-prove
    content: "Produce and verify: Version-bounded transformations and ownership/conflict receipts including old validators, explicit native MF SSR where contract requires it, nested bridge coordination and historical configuration preservation. No migration of arbitrary reference repositories."
    status: pending
isProject: false
---

# Implement exact one-time native schema and API transformations

## Execution Notes

Tracking: `modernjs-cdhz.29.93`. Mode: **source implementation for migration leaves after contracts; parallel with transaction owner**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Reuse historical recognizers and scope guards for each proven supported schema/API transition. Replace recognized owned code with native imports; preserve authored source and reject unknown/custom baselines before promotion. Provide leaf invocation patches to cw-transaction, never edit its orchestrator.

Required output: Version-bounded transformations and ownership/conflict receipts including old validators, explicit native MF SSR where contract requires it, nested bridge coordination and historical configuration preservation. No migration of arbitrary reference repositories.

External prerequisites:

- external fact: exact native target APIs required by each transformation are implemented by their legal component owners; absent APIs block only that transformation

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/api-artifact-migration.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/api-artifact-hashes.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/api-metadata.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/workspace-artifact-ownership.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-modern-configs.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-typescript.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-backend-federation.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-zerops.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-artifacts-removal.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-ui-source.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/generated-patches.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/shared-api-infrastructure.ts`
- `packages/toolkit/ultramodern-create/src/ultramodern-tooling/commands/migrate-strict-effect/react-router-retirement.ts`
- `packages/toolkit/ultramodern-create/tests/shared-api-migration.test.ts`
- `packages/toolkit/ultramodern-create/tests/migrate-consumer-config-preservation.test.ts`
- `packages/toolkit/ultramodern-create/tests/migrate-react-router.test.ts`

Out of scope: No source/config changes in same-contract path, generator shared files/build identity writer, MigrationIo/orchestrator/cohort ownership, live application edits or global-hook bypass.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `cw-legacy`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [cw-update-contract](um-parallel-20260909-cw-update-contract.plan.md), [cw-historical-fixtures](um-parallel-20260909-cw-historical-fixtures.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: Focused historical packed fixtures verify owned/custom baseline distinction, raw metadata, custom scripts/config/patches, symlinks, preflight conflicts, dry-run and repeated application. Transaction-integration and actual old→current→next acceptance remain cw-transition-proof.

Stop condition: Unknown ownership, external bridge outside coordinated scope or unsupported version causes actionable atomic preflight failure; do not add compatibility wrappers.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
