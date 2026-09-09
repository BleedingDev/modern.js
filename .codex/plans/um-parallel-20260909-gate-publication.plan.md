---
name: um-parallel-20260909-gate-publication
overview: "Reconcile actual fork-main changes, select an unused coherent version and publish all cohort packages/sidecars using the canonical trusted producer and OIDC workflow; verify registry/source/provenance/digest identity."
todos:
  - id: gate-publication-deliver
    content: "Reconcile actual fork-main changes, select an unused coherent version and publish all cohort packages/sidecars using the canonical trusted producer and OIDC workflow; verify registry/source/provenance/digest identity."
    status: pending
  - id: gate-publication-prove
    content: "Produce and verify: Authenticated non-dry publication outcome and exact complete registry cohort tied to the accepted producer/candidate."
    status: pending
isProject: false
---

# Publish the fully accepted exact cohort through the trusted fork workflow

## Execution Notes

Tracking: `modernjs-cdhz.29.106`. Mode: **single release owner; externally visible execution only under applicable authorization**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Reconcile actual fork-main changes, select an unused coherent version and publish all cohort packages/sidecars using the canonical trusted producer and OIDC workflow; verify registry/source/provenance/digest identity.

Required output: Authenticated non-dry publication outcome and exact complete registry cohort tied to the accepted producer/candidate.

External prerequisites:

- external: every required upstream landing is actually incorporated and final zero/quality/candidate receipts remain valid for release source

- external: execution has resumed and applicable fork publication authorization still covers the release; planning itself grants none

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `.github/workflows/publish-bleedingdev.yml`

Out of scope: No origin publish/push, workflow policy weakening, dry-run relabeling or use of old source acceptance as proof for new bytes.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `gate-publication`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-source-erp](um-parallel-20260909-gate-source-erp.plan.md), [gate-source-tractor](um-parallel-20260909-gate-source-tractor.plan.md), [gate-update-acceptance](um-parallel-20260909-gate-update-acceptance.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: Recheck fork-main/ref/cap changes; if promotion changes source/package contents, return to final source assembly/qualification/acceptance before publishing. Registry tags and all tarball digests match the producer; recovery stays bound to original producer identity.

Stop condition: Source drift, incomplete prerequisites/cohort, already-used conflicting version, unlanded required upstream code or partial publish prevents success declaration.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
