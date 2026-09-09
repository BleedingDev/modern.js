---
name: um-parallel-20260909-repair-localization-cli-server
overview: "Repair CLI/server/shared-type governed edges while preserving generated native locale routes, per-entry configuration, backend defaults, API prefix exclusion, redirects and cookie/header negotiation. Keep localisedUrls.test.ts with both CLI and server because it directly exercises both owners."
todos:
  - id: repair-localization-cli-server-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-localization-cli-server-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-localization-cli-server-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: CLI/server locale contract and route configuration

## Execution Notes

Tracking: `modernjs-cdhz.29.22`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Repair CLI/server/shared-type governed edges while preserving generated native locale routes, per-entry configuration, backend defaults, API prefix exclusion, redirects and cookie/header negotiation. Keep localisedUrls.test.ts with both CLI and server because it directly exercises both owners.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-i18n/src/cli/index.ts`
- `packages/runtime/plugin-i18n/src/server/apiPrefix.ts`
- `packages/runtime/plugin-i18n/src/server/detectorOptions.ts`
- `packages/runtime/plugin-i18n/src/server/index.ts`
- `packages/runtime/plugin-i18n/src/server/redirectPolicy.ts`
- `packages/runtime/plugin-i18n/src/shared/type.ts`
- `packages/runtime/plugin-i18n/tests/backendDefaults.test.ts`
- `packages/runtime/plugin-i18n/tests/localisedUrls.test.ts`
- `packages/toolkit/i18n-utils/tsconfig.json`

Local seam prerequisites:

- Read-only legal-route and seam audits start immediately. Source writes require this shard’s per-identity legal route against the actual complete PR range, and only the interfaces it consumes below; no whole-lane or global ownership-contract completion barrier.

- Freeze actual supported locale configuration and native CLI/ServerPlugin extension seams with their owning lanes; use an exact prepared upstream proposal only where the native seam is insufficient. Integration/release waits for required real upstream landing.

- Coordinate only the shared redirect predicate contract with localization-navigation and detection option/instance types with localization-detection; do not await either entire shard.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-i18n/src/cli/index.ts`
- `packages/runtime/plugin-i18n/src/server/apiPrefix.ts`
- `packages/runtime/plugin-i18n/src/server/detectorOptions.ts`
- `packages/runtime/plugin-i18n/src/server/index.ts`
- `packages/runtime/plugin-i18n/src/server/redirectPolicy.ts`
- `packages/runtime/plugin-i18n/src/shared/type.ts`
- `packages/runtime/plugin-i18n/tests/backendDefaults.test.ts`
- `packages/runtime/plugin-i18n/tests/localisedUrls.test.ts`
- `packages/toolkit/i18n-utils/tsconfig.json`

Prospective destinations (not write grants):

Assigned originals plus separately reserved genuine fork-owned CLI/server/config destinations after route audit. This owner publishes the shared LocaleDetectionOptions, LocalisedUrlsOption and backend configuration contract; public package exports remain packaging-owned.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-i18n/package.json -> packaging owner (dependencies, exports and cohort); this shard supplies exact patch requirements only

- packages/runtime/i18n-runtime-extensions/package.json -> packaging owner if this existing fork package is the approved destination

- pnpm-lock.yaml -> packaging lockfile owner only

- FORK-DIVERGENCE.md -> single ledger integration owner; source owner supplies per-identity legal evidence

- scripts/ultramodern-boundary-check/divergence-allowlist.json -> designated boundary/provenance owner; no scope or budget workaround

- packages/runtime/plugin-i18n/src/shared/type.ts -> sole writer is this shard; providers, detection and navigation submit contract requirements

- packages/runtime/plugin-i18n/src/runtime/utils.ts -> localization-navigation owns runtime redirect parity; server owner supplies expected policy cases

- packages/runtime/plugin-i18n/rstest.config.mts -> localization-providers owns test routing changes

- packages/toolkit/i18n-utils/package.json -> packaging owner; tsconfig repair must preserve its actual build/type output

## Operator Guidance

Owner: `repair-localization-cli-server`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-localization-cli-server](um-parallel-20260909-audit-localization-cli-server.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run backendDefaults.test.ts and complete localisedUrls.test.ts, covering runtime-entry choice, route generation and server API exclusions.

- Exercise URL negotiation, redirects, fallback language, cookies/headers and entry overrides through native server setup; coordinate redirectPolicy.test.ts with navigation owner.

- Type/build check i18n-utils under its actual config; report three governed edges: src/cli/index.ts, src/server/index.ts, src/shared/type.ts.

Stop condition: Stop with every assigned identity accounted for in a deletion/move/retention map, behavior proved, complete-PR and cumulative audited deltas measured, and assigned governed edges actually removed. Any unresolved route remains explicitly blocked; never rename identities, split a PR to evade the cap, hide imports, restore both implementations, or add an application wrapper.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
