---
name: um-parallel-20260909-repair-localization-detection
overview: "Relocate or legally repair language detection as one cohesive subsystem; preserve precedence among URL, SSR, configured detectors and storage, supported-language filtering, initialization and cache behavior."
todos:
  - id: repair-localization-detection-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-localization-detection-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-localization-detection-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Language detection, cache and SSR precedence

## Execution Notes

Tracking: `modernjs-cdhz.29.28`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Relocate or legally repair language detection as one cohesive subsystem; preserve precedence among URL, SSR, configured detectors and storage, supported-language filtering, initialization and cache behavior.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/cache.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/detector.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/initOptions.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/language.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/path.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/priority.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/ssr.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/types.ts`
- `packages/runtime/plugin-i18n/tests/i18nUtils.test.ts`

Local seam prerequisites:

- Read-only legal-route and seam audits start immediately. Source writes require this shard’s per-identity legal route against the actual complete PR range, and only the interfaces it consumes below; no whole-lane or global ownership-contract completion barrier.

- Freeze navigation’s detectLanguageFromPath contract consumed by detection/path.ts and the native instance/detector option contract used by server and provider initialization.

- Audit detection/index.ts, middleware and i18n instance/utils caller ownership before choosing extraction; any newly exposed identity is added to the baseline register and given one owner before edits.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/cache.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/detector.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/initOptions.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/language.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/path.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/priority.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/ssr.ts`
- `packages/runtime/plugin-i18n/src/runtime/i18n/detection/types.ts`
- `packages/runtime/plugin-i18n/tests/i18nUtils.test.ts`

Prospective destinations (not write grants):

Eight inventoried detection implementation modules and the focused i18n utility suite. Non-inventory detection barrels, middleware and instance helpers are read-only integration seams until separately audited and assigned; relocating leaves must not strand governed upstream callers.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-i18n/package.json -> packaging owner (dependencies, exports and cohort); this shard supplies exact patch requirements only

- packages/runtime/i18n-runtime-extensions/package.json -> packaging owner if this existing fork package is the approved destination

- pnpm-lock.yaml -> packaging lockfile owner only

- FORK-DIVERGENCE.md -> single ledger integration owner; source owner supplies per-identity legal evidence

- scripts/ultramodern-boundary-check/divergence-allowlist.json -> designated boundary/provenance owner; no scope or budget workaround

- packages/runtime/plugin-i18n/src/runtime/i18n/detection/index.ts, middleware.ts, middleware.node.ts, config.ts and src/runtime/i18n/instance.ts, utils.ts -> non-inventory caller identities: baseline/ownership audit required, no implicit write authorization

- packages/runtime/plugin-i18n/src/runtime/utils.ts -> localization-navigation owns detectLanguageFromPath changes

- packages/runtime/plugin-i18n/src/runtime/pluginSetup.ts and contextHelpers.ts -> localization-providers owns cache/init consumers

- packages/runtime/plugin-i18n/src/shared/type.ts and src/server/detectorOptions.ts -> localization-cli-server owns detector configuration integration

- packages/runtime/plugin-i18n/rstest.config.mts -> localization-providers owns moved test entries

## Operator Guidance

Owner: `repair-localization-detection`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-localization-detection](um-parallel-20260909-audit-localization-detection.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run i18nUtils.test.ts and focused positive/negative language-priority/cache tests in the lawful implementation owner.

- Verify SSR-to-client language continuity, storage/detector fallback, allowed-language rejection and independent native external i18next instance initialization.

- Coordinate existing link.test.ts and routerAdapter.test.tsx with navigation owner for end-to-end language change behavior; do not duplicate or weaken their fixtures.

Stop condition: Stop with every assigned identity accounted for in a deletion/move/retention map, behavior proved, complete-PR and cumulative audited deltas measured, and assigned governed edges actually removed. Any unresolved route remains explicitly blocked; never rename identities, split a PR to evade the cap, hide imports, restore both implementations, or add an application wrapper.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
