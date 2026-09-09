---
name: um-parallel-20260909-repair-router-realms-prefetch
overview: "Keep provider registration, app-owned realms, lifecycle snapshots and Link/preload behavior together because all consume the same runtime/router identity and isolation contract."
todos:
  - id: repair-router-realms-prefetch-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-router-realms-prefetch-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-router-realms-prefetch-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Native router providers, lifecycle and prefetch

## Execution Notes

Tracking: `modernjs-cdhz.29.4`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Keep provider registration, app-owned realms, lifecycle snapshots and Link/preload behavior together because all consume the same runtime/router identity and isolation contract.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-runtime/src/router/runtime/PrefetchLink.tsx`
- `packages/runtime/plugin-runtime/src/router/runtime/lifecycle.ts`
- `packages/runtime/plugin-runtime/src/router/runtime/provider.ts`
- `packages/runtime/plugin-runtime/src/router/runtime/redirect.ts`
- `packages/runtime/plugin-runtime/src/router/runtime/utils.tsx`
- `packages/runtime/plugin-runtime/tests/router/internalProvider.test.ts`
- `packages/runtime/plugin-runtime/tests/router/lifecycle.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/plugin.client.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/prefetch-realm-isolation.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/prefetch.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/provider-realm-isolation.test.ts`
- `packages/runtime/plugin-runtime/tests/router/provider.test.ts`
- `packages/runtime/plugin-runtime/tests/router/routerHelper.test.ts`
- `packages/runtime/plugin-runtime/tests/router/utils.test.ts`

Local seam prerequisites:

- Read-only route audit can start immediately from recorded identities; reconcile against the selected integration head before accepting file dispositions. Source writes require this shard's own evidence-backed lawful route and exact source/destination reservation, not completion of a global ownership wave.

- Prove provider hook registration and framework resolution against the actual router runtime plugin; negotiate exact lifecycle snapshot/accessor contract with context-head and cleanup/hydration consumers in runtime-ssr.

- Prove native Link/NavLink and TanStack preload integration without click interception, synthetic anchor handlers or app navigation wrappers. The current PrefetchLink dependency on runtime-extensions is an edge to remove, not a reusable legal seam.

- Source relocation can proceed after its local interfaces are frozen. Integration of a neutral upstream provider or prefetch seam must wait for its actual acceptance if the full-PR per-file 20-line cap cannot accommodate the lawful caller patch.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-runtime/src/router/runtime/PrefetchLink.tsx`
- `packages/runtime/plugin-runtime/src/router/runtime/lifecycle.ts`
- `packages/runtime/plugin-runtime/src/router/runtime/provider.ts`
- `packages/runtime/plugin-runtime/src/router/runtime/redirect.ts`
- `packages/runtime/plugin-runtime/src/router/runtime/utils.tsx`
- `packages/runtime/plugin-runtime/tests/router/internalProvider.test.ts`
- `packages/runtime/plugin-runtime/tests/router/lifecycle.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/plugin.client.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/prefetch-realm-isolation.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/prefetch.test.tsx`
- `packages/runtime/plugin-runtime/tests/router/provider-realm-isolation.test.ts`
- `packages/runtime/plugin-runtime/tests/router/provider.test.ts`
- `packages/runtime/plugin-runtime/tests/router/routerHelper.test.ts`
- `packages/runtime/plugin-runtime/tests/router/utils.test.ts`

Prospective destinations (not write grants):

Move genuine fork routing behavior to plugin-tanstack and/or runtime-extensions using native router/runtime plugin hooks. Own PrefetchLink.tsx and its existing audited tests as identities, not freely movable fork files.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-runtime/src/core/context/index.ts

- packages/runtime/plugin-runtime/src/core/context/extensions.ts

- packages/runtime/plugin-runtime/src/router/runtime/types.ts

- packages/runtime/plugin-runtime/src/router/runtime/hooks.ts

- packages/runtime/plugin-runtime/src/router/runtime/index.ts

- packages/runtime/plugin-runtime/src/core/server/routerCleanup.ts

- packages/runtime/plugin-runtime/package.json

- packages/runtime/runtime-extensions/package.json

- packages/runtime/plugin-tanstack/package.json

- pnpm-lock.yaml

- FORK-DIVERGENCE.md

- scripts/ultramodern-boundary-check/divergence-allowlist.json

- scripts/ultramodern-boundary-check/allowlist.json

- packages/runtime/plugin-runtime/src/router/runtime/plugin.tsx

- packages/runtime/plugin-runtime/src/router/runtime/plugin.node.tsx

## Operator Guidance

Owner: `repair-router-realms-prefetch`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-router-realms-prefetch](um-parallel-20260909-audit-router-realms-prefetch.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run lifecycle, provider, internalProvider, provider-realm-isolation, plugin.client, prefetch, prefetch-realm-isolation, routerHelper and utils suites. Preserve cancellation, native modified-click/defaultPrevented behavior, app-owned provider realms, cleanup and cross-shell isolation.

- Verify native TanStack/React/router identity on real bundles; remove the PrefetchLink governed import edge. Include all prior PR changes when measuring audited PrefetchLink.tsx, utils.tsx and their audited tests.

Stop condition: Every reserved routing identity is repaired under its own legal route and native behavior proofs pass. An over-cap PrefetchLink or provider seam blocks this shard's integration, not federation/debugger/CLI audits.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
