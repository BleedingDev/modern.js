---
name: um-parallel-20260909-gate-receipt-fixtures
overview: "Reuse existing receipt/acceptance helpers and add only missing regressions for source/packed/published identity mismatch and owned-resource isolation. This exact new test path is reserved; existing driver implementation stays read-only unless a bounded follow-up is explicitly added."
todos:
  - id: gate-receipt-fixtures-deliver
    content: "Reuse existing receipt/acceptance helpers and add only missing regressions for source/packed/published identity mismatch and owned-resource isolation. This exact new test path is reserved; existing driver implementation stays read-only unless a bounded follow-up is explicitly added."
    status: pending
  - id: gate-receipt-fixtures-prove
    content: "Produce and verify: Self-checked receipt/ownership failure fixtures available before final source assembly."
    status: pending
isProject: false
---

# Prepare independent acceptance identity and resource regressions

## Execution Notes

Tracking: `modernjs-cdhz.29.110`. Mode: **test preparation**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Reuse existing receipt/acceptance helpers and add only missing regressions for source/packed/published identity mismatch and owned-resource isolation. This exact new test path is reserved; existing driver implementation stays read-only unless a bounded follow-up is explicitly added.

Required output: Self-checked receipt/ownership failure fixtures available before final source assembly.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `scripts/ultramodern-production-readiness/__tests__/parallel-acceptance-contract.test.mjs`

Out of scope: Other owners’ source, upstream submission, consumer workarounds, shared configuration changes and unowned mutable resources.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `gate-receipt-fixtures`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-acceptance-contract](um-parallel-20260909-gate-acceptance-contract.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: Deliberate source-version/cohort mismatch and unsafe fixture ancestry must fail; private mutable roots and process ownership must be observable.

Stop condition: Missing prerequisite evidence or a conflicting write/resource reservation blocks this node only; no fake success or scope expansion.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
