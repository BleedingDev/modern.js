---
name: um-parallel-20260909-repair-federation-surfaces
overview: "Own the module-federation directory and matching tests as a cohesive API: its index contains telemetry behavior and re-exports, consume-surface imports that index, and distributed SSR reads runtime context."
todos:
  - id: repair-federation-surfaces-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-federation-surfaces-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-federation-surfaces-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Federated surface consumption and recovery

## Execution Notes

Tracking: `modernjs-cdhz.29.6`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Own the module-federation directory and matching tests as a cohesive API: its index contains telemetry behavior and re-exports, consume-surface imports that index, and distributed SSR reads runtime context.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-runtime/src/module-federation/consume-surface.ts`
- `packages/runtime/plugin-runtime/src/module-federation/distributed-ssr.tsx`
- `packages/runtime/plugin-runtime/src/module-federation/index.ts`
- `packages/runtime/plugin-runtime/src/module-federation/last-known-good.ts`
- `packages/runtime/plugin-runtime/src/module-federation/manifest-recovery-runtime-plugin.ts`
- `packages/runtime/plugin-runtime/src/module-federation/surface-resolution-types.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/consume-surface.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/distributed-ssr.test.tsx`
- `packages/runtime/plugin-runtime/tests/module-federation/fixtures/manifest-recovery-node-child.cjs`
- `packages/runtime/plugin-runtime/tests/module-federation/index.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/last-known-good.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-runtime-plugin.test.ts`

Local seam prerequisites:

- Read-only route audit can start immediately from recorded identities; reconcile against the selected integration head before accepting file dispositions. Source writes require this shard's own evidence-backed lawful route and exact source/destination reservation, not completion of a global ownership wave.

- Prove native RuntimePlugin/federation registration entrypoints and exact destination modules. Negotiate toolkit surface-resolution/discovery exports and the wait utility with toolkit owners.

- Agree runtime context access for distributed SSR with context-head and fragment locals/resolution contract with server/SSR owners. This can happen while each peer audits; whole peer completion is unnecessary.

- Retain current emergency-age/last-known-good security policy until separate evidence and product authorization permit retirement. A missing required upstream extension is an explicit external dependency for the affected integration, not a reason to silently change behavior.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-runtime/src/module-federation/consume-surface.ts`
- `packages/runtime/plugin-runtime/src/module-federation/distributed-ssr.tsx`
- `packages/runtime/plugin-runtime/src/module-federation/index.ts`
- `packages/runtime/plugin-runtime/src/module-federation/last-known-good.ts`
- `packages/runtime/plugin-runtime/src/module-federation/manifest-recovery-runtime-plugin.ts`
- `packages/runtime/plugin-runtime/src/module-federation/surface-resolution-types.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/consume-surface.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/distributed-ssr.test.tsx`
- `packages/runtime/plugin-runtime/tests/module-federation/fixtures/manifest-recovery-node-child.cjs`
- `packages/runtime/plugin-runtime/tests/module-federation/index.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/last-known-good.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts`
- `packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-runtime-plugin.test.ts`

Prospective destinations (not write grants):

Genuine fork-owned runtime extension modules for consumption, distributed fragments, last-known-good and manifest recovery. Preserve delivery-unit identity and required degradation policy; do not grow an upstream runtime package subsystem.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-runtime/src/module-federation/index.ts

- packages/runtime/plugin-runtime/src/module-federation/surface-resolution-types.ts

- packages/runtime/plugin-runtime/src/core/context/public.ts

- packages/toolkit/utils/src/universal/surface-resolution/index.ts

- packages/toolkit/utils/src/universal/wait.ts

- packages/runtime/plugin-runtime/package.json

- packages/runtime/runtime-extensions/package.json

- packages/runtime/plugin-tanstack/package.json

- pnpm-lock.yaml

- FORK-DIVERGENCE.md

- scripts/ultramodern-boundary-check/divergence-allowlist.json

- scripts/ultramodern-boundary-check/allowlist.json

## Operator Guidance

Owner: `repair-federation-surfaces`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-federation-surfaces](um-parallel-20260909-audit-federation-surfaces.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run all module-federation suites including node child-process recovery fixture. Exercise mandatory degraded state, critical failure propagation, bounded retry/timeout, non-retryable contract/identity failures, last-known-good validity and distributed fragment isolation.

- Verify browser/Node packaging and actual public-export identity, including the index/consume-surface cycle. Preserve complete delivery-unit metadata through the toolkit handoff.

Stop condition: All reserved federation implementations and tests leave governed upstream locations through proved ownership routes, with no duplicate implementation retained. Required fragment or discovery contract changes remain explicit handoffs.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
