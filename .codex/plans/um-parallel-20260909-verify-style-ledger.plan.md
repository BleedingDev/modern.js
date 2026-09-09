---
name: um-parallel-20260909-verify-style-ledger
overview: "Run repository lint, changeset checks and independent full-PR ledger/cap accounting on the final ref; all required gates must pass."
todos:
  - id: verify-style-ledger-deliver
    content: "Run repository lint, changeset checks and independent full-PR ledger/cap accounting on the final ref; all required gates must pass."
    status: pending
  - id: verify-style-ledger-prove
    content: "Produce and verify: Exact-ref check receipts with toolchain, workspace and artifact identities."
    status: pending
isProject: false
---

# Verify style, changesets and complete-PR governance

## Execution Notes

Tracking: `modernjs-cdhz.29.114`. Mode: **verification-only**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Run repository lint, changeset checks and independent full-PR ledger/cap accounting on the final ref; all required gates must pass.

Required output: Exact-ref check receipts with toolchain, workspace and artifact identities.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Out of scope: Other owners’ source, upstream submission, consumer workarounds, shared configuration changes and unowned mutable resources.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `verify-style-ledger`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-final-zero](um-parallel-20260909-gate-final-zero.plan.md), [gate-acceptance-contract](um-parallel-20260909-gate-acceptance-contract.plan.md)

Resource locks: `private-checkout:verify-style-ledger`, `private-build-root:verify-style-ledger`

Verification: Run repository lint, changeset checks and independent full-PR ledger/cap accounting on the final ref; all required gates must pass.

Stop condition: Missing prerequisite evidence or a conflicting write/resource reservation blocks this node only; no fake success or scope expansion.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
