---
name: um-parallel-20260909-gate-update-acceptance
overview: "Exercise supported published-floor to candidate and candidate to distinct real next-compatible local cohort using the documented entrypoint; run update success/idempotence, ownership/install/check/interruption/registry failure and rollback proofs. This is the single final real-cohort transition run; it also fulfills the consumer transition-proof proposal, preventing duplicate full acceptance."
todos:
  - id: gate-update-acceptance-deliver
    content: "Exercise supported published-floor to candidate and candidate to distinct real next-compatible local cohort using the documented entrypoint; run update success/idempotence, ownership/install/check/interruption/registry failure and rollback proofs. This is the single final real-cohort transition run; it also fulfills the consumer transition-proof proposal, preventing duplicate full acceptance."
    status: pending
  - id: gate-update-acceptance-prove
    content: "Produce and verify: Machine-readable diffs, byte-exact rollback/no-op receipts, cohort/runtime results and observed elapsed/RSS comparisons."
    status: pending
isProject: false
---

# Prove two real update transitions and failure recovery

## Execution Notes

Tracking: `modernjs-cdhz.29.105`. Mode: **independent acceptance job with private registry and fixtures; runtime phases lease conflicting ports**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Exercise supported published-floor to candidate and candidate to distinct real next-compatible local cohort using the documented entrypoint; run update success/idempotence, ownership/install/check/interruption/registry failure and rollback proofs. This is the single final real-cohort transition run; it also fulfills the consumer transition-proof proposal, preventing duplicate full acceptance.

Required output: Machine-readable diffs, byte-exact rollback/no-op receipts, cohort/runtime results and observed elapsed/RSS comparisons.

External prerequisites:

- external: real distinct next-compatible rehearsal tarballs/cohort prepared through canonical helpers and explicitly local identity; its changes have relevant validation

- external: private registry/workspace/resource leases; runtime phases acquire shared host port mutex if needed

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Out of scope: No other agent's OntOS checkout/candidate/active rehearsal, invented savings, hook bypasses or claim that the next local version was published.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `gate-update-acceptance`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-candidate-freeze](um-parallel-20260909-gate-candidate-freeze.plan.md), [cw-transition-fixtures](um-parallel-20260909-cw-transition-fixtures.plan.md)

Resource locks: `host-default-runtime-ports`

Verification: Same-contract success changes only dependencies, lockfile and narrowly derived release identity data; zero consumer TS/JS or deployment-config edits and zero manual repair. Legacy native migrations execute once; custom files survive; prior accepted version works after failure.

Stop condition: Reused identical bytes with a fake next-version label, missing supported floor proof, failed rollback or manual/config repair blocks acceptance.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
