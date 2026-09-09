---
name: um-parallel-20260909-repair-localization-providers
overview: "Repair provider/plugin ownership and the context/hooks import edges while retaining external i18next stores, React integration identity, Suspense safety, hydration and the explicit no-react-i18next entry behavior."
todos:
  - id: repair-localization-providers-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-localization-providers-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-localization-providers-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Provider composition and native i18next instance identity

## Execution Notes

Tracking: `modernjs-cdhz.29.24`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Repair provider/plugin ownership and the context/hooks import edges while retaining external i18next stores, React integration identity, Suspense safety, hydration and the explicit no-react-i18next entry behavior.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-i18n/rstest.config.mts`
- `packages/runtime/plugin-i18n/src/runtime/context.tsx`
- `packages/runtime/plugin-i18n/src/runtime/contextHelpers.ts`
- `packages/runtime/plugin-i18n/src/runtime/core.tsx`
- `packages/runtime/plugin-i18n/src/runtime/hooks.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/react-i18next.ts`
- `packages/runtime/plugin-i18n/src/runtime/no-react-i18next.tsx`
- `packages/runtime/plugin-i18n/src/runtime/pluginSetup.ts`
- `packages/runtime/plugin-i18n/src/runtime/providerComposition.tsx`
- `packages/runtime/plugin-i18n/src/runtime/reactI18next.ts`
- `packages/runtime/plugin-i18n/tests/federatedI18nBoundary.client.test.tsx`
- `packages/runtime/plugin-i18n/tests/federatedI18nBoundary.test.tsx`
- `packages/runtime/plugin-i18n/tests/peerCohort.test.ts`
- `packages/runtime/plugin-i18n/tests/reactI18nextRuntimeBoundary.test.ts`

Local seam prerequisites:

- Read-only legal-route and seam audits start immediately. Source writes require this shard’s per-identity legal route against the actual complete PR range, and only the interfaces it consumes below; no whole-lane or global ownership-contract completion barrier.

- Consume localization-cli-server’s frozen locale/backend configuration shape.

- Freeze navigation’s useI18nRouterAdapter and URL utility contracts before changing provider/hook consumers; freeze detection language/cache/SSR interfaces before changing plugin setup. These interface agreements do not require producer shard completion.

- Resolve legal routes for audited context.tsx and hooks.ts before modification; direct restoration is not assumed to fit the complete-PR cap.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-i18n/rstest.config.mts`
- `packages/runtime/plugin-i18n/src/runtime/context.tsx`
- `packages/runtime/plugin-i18n/src/runtime/contextHelpers.ts`
- `packages/runtime/plugin-i18n/src/runtime/core.tsx`
- `packages/runtime/plugin-i18n/src/runtime/hooks.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/react-i18next.ts`
- `packages/runtime/plugin-i18n/src/runtime/no-react-i18next.tsx`
- `packages/runtime/plugin-i18n/src/runtime/pluginSetup.ts`
- `packages/runtime/plugin-i18n/src/runtime/providerComposition.tsx`
- `packages/runtime/plugin-i18n/src/runtime/reactI18next.ts`
- `packages/runtime/plugin-i18n/tests/federatedI18nBoundary.client.test.tsx`
- `packages/runtime/plugin-i18n/tests/federatedI18nBoundary.test.tsx`
- `packages/runtime/plugin-i18n/tests/peerCohort.test.ts`
- `packages/runtime/plugin-i18n/tests/reactI18nextRuntimeBoundary.test.ts`

Prospective destinations (not write grants):

Provider lifecycle, runtime plugin composition, hooks and their coupled identity tests; exact fork destination modules require a separate disjoint reservation before writes. This shard is the single localization test-runner config owner.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-i18n/package.json -> packaging owner (dependencies, exports and cohort); this shard supplies exact patch requirements only

- packages/runtime/i18n-runtime-extensions/package.json -> packaging owner if this existing fork package is the approved destination

- pnpm-lock.yaml -> packaging lockfile owner only

- FORK-DIVERGENCE.md -> single ledger integration owner; source owner supplies per-identity legal evidence

- scripts/ultramodern-boundary-check/divergence-allowlist.json -> designated boundary/provenance owner; no scope or budget workaround

- packages/runtime/plugin-i18n/rstest.config.mts -> sole writer is this shard; other shards supply moved test entries and aliases

- packages/runtime/plugin-i18n/src/shared/type.ts -> localization-cli-server owns changes

- packages/runtime/plugin-i18n/src/runtime/routerAdapter.tsx and src/runtime/utils.ts -> localization-navigation owns changes

- packages/runtime/plugin-i18n/tests/type-fixture/i18nInstanceTypes.fixture.ts -> localization-navigation owns entire coupled fixture/runner; this shard supplies required identity assertions

- packages/runtime/plugin-runtime/package.json -> packaging owner; peerCohort.test.ts is a consumer of that final cohort

## Operator Guidance

Owner: `repair-localization-providers`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-localization-providers](um-parallel-20260909-audit-localization-providers.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run both federatedI18nBoundary suites with external stores, SSR and client hydration; preserve Suspense-safe behavior.

- Run reactI18nextRuntimeBoundary.test.ts on real bundle output, including no-react entry and optional integration identity.

- Run peerCohort.test.ts after packaging handoff; coordinate full type fixture with navigation. Report context.tsx and hooks.ts governed-edge removal.

Stop condition: Stop with every assigned identity accounted for in a deletion/move/retention map, behavior proved, complete-PR and cumulative audited deltas measured, and assigned governed edges actually removed. Any unresolved route remains explicitly blocked; never rename identities, split a PR to evade the cap, hide imports, restore both implementations, or add an application wrapper.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
