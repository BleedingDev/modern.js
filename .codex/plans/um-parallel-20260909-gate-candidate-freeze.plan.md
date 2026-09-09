---
name: um-parallel-20260909-gate-candidate-freeze
overview: "After final-ref checks pass, verify clean committed/pushed bleedingdev source; build/pack the complete cohort and sidecars and freeze source, manifest, tarball and toolchain digests for all acceptance lanes."
todos:
  - id: gate-candidate-freeze-deliver
    content: "After final-ref checks pass, verify clean committed/pushed bleedingdev source; build/pack the complete cohort and sidecars and freeze source, manifest, tarball and toolchain digests for all acceptance lanes."
    status: pending
  - id: gate-candidate-freeze-prove
    content: "Produce and verify: Immutable full-cohort candidate plus target-private source/update acceptance workspaces consuming identical accepted bytes."
    status: pending
isProject: false
---

# Freeze and distribute one qualified immutable package candidate

## Execution Notes

Tracking: `modernjs-cdhz.29.102`. Mode: **single source/artifact identity owner**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

After final-ref checks pass, verify clean committed/pushed bleedingdev source; build/pack the complete cohort and sidecars and freeze source, manifest, tarball and toolchain digests for all acceptance lanes.

Required output: Immutable full-cohort candidate plus target-private source/update acceptance workspaces consuming identical accepted bytes.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Out of scope: No public publication or assumption that source checks prove registry-installed behavior.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

## Operator Guidance

Owner: `gate-candidate-freeze`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [verify-generator](um-parallel-20260909-verify-generator.plan.md), [verify-publish-tooling](um-parallel-20260909-verify-publish-tooling.plan.md), [verify-types-exports](um-parallel-20260909-verify-types-exports.plan.md), [verify-style-ledger](um-parallel-20260909-verify-style-ledger.plan.md), [verify-platform-runtime](um-parallel-20260909-verify-platform-runtime.plan.md), [verify-component-runtime-router](um-parallel-20260909-verify-component-runtime-router.plan.md), [verify-component-runtime-ssr](um-parallel-20260909-verify-component-runtime-ssr.plan.md), [verify-component-localization](um-parallel-20260909-verify-component-localization.plan.md), [verify-component-server](um-parallel-20260909-verify-component-server.plan.md), [verify-component-bff](um-parallel-20260909-verify-component-bff.plan.md), [verify-component-build](um-parallel-20260909-verify-component-build.plan.md), [verify-component-toolkit](um-parallel-20260909-verify-component-toolkit.plan.md), [verify-component-docs](um-parallel-20260909-verify-component-docs.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: Packed type/export/cohort checks against actual produced bytes; producer/manifest/source linkage; new artifacts rather than another agent's registry/candidate or historical accepted bundle.

Stop condition: Uncommitted source, mismatched bytes, partial cohort, failed packed checks or unavailable publication identity cannot be treated as accepted candidate. Any content change creates a new candidate and reruns relevant qualification.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
