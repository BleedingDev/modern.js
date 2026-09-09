---
name: um-parallel-20260909-repair-ssr-browser-proofs
overview: "Own the runtime-router inventory tests that exercise SSR/browser implementations assigned elsewhere. This is a concrete regression migration worker with existing files, not a second owner of SSR production code."
todos:
  - id: repair-ssr-browser-proofs-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-ssr-browser-proofs-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-ssr-browser-proofs-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: SSR and hydration regression ownership

## Execution Notes

Tracking: `modernjs-cdhz.29.12`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Own the runtime-router inventory tests that exercise SSR/browser implementations assigned elsewhere. This is a concrete regression migration worker with existing files, not a second owner of SSR production code.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-runtime/tests/cli/ssr/loadable-bundler-plugin.test.ts`
- `packages/runtime/plugin-runtime/tests/core/browser/hydrate.test.tsx`
- `packages/runtime/plugin-runtime/tests/core/server/federatedCss.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/loadable.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/requestResponse.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/routerCleanup.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/scriptOrder.security.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/ssrHelpers.matrix.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/string.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/string.test.tsx`
- `packages/runtime/plugin-runtime/tests/exports/loadable.test.ts`

Local seam prerequisites:

- Read-only route audit can start immediately from recorded identities; reconcile against the selected integration head before accepting file dispositions. Source writes require this shard's own evidence-backed lawful route and exact source/destination reservation, not completion of a global ownership wave.

- Immediately audit assertions, imports, fixture setup and required failure cases in these existing tests. Prove destination test ownership independently; no need to wait for all runtime-ssr routes.

- For each migrated suite, wait only for the exact implementation/export seam it imports: hydration/loadable compiler contract, request-response cleanup, CSS/script serialization, string rendering or context/head collection.

- Coordinate router-realms-prefetch snapshot/cleanup fixture contract and context-head Helmet/context identity. If implementation is blocked on upstream, retain the proof against an exact proposal and label it non-integratable until landing.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-runtime/tests/cli/ssr/loadable-bundler-plugin.test.ts`
- `packages/runtime/plugin-runtime/tests/core/browser/hydrate.test.tsx`
- `packages/runtime/plugin-runtime/tests/core/server/federatedCss.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/loadable.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/requestResponse.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/routerCleanup.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/scriptOrder.security.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/ssrHelpers.matrix.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/string.test.ts`
- `packages/runtime/plugin-runtime/tests/core/server/string.test.tsx`
- `packages/runtime/plugin-runtime/tests/exports/loadable.test.ts`

Prospective destinations (not write grants):

Relocate genuine fork-owned regression tests to the proved runtime-extensions/native seam owners and preserve real bundle coverage. Source implementations remain with runtime-ssr or the explicitly identified current owner.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-runtime/src/core/browser/hydrate.tsx

- packages/runtime/plugin-runtime/src/cli/ssr/loadable-bundler-plugin.ts

- packages/runtime/plugin-runtime/src/core/server/federatedCss.ts

- packages/runtime/plugin-runtime/src/core/server/requestResponse.ts

- packages/runtime/plugin-runtime/src/core/server/routerCleanup.ts

- packages/runtime/plugin-runtime/src/core/server/scriptOrder.ts

- packages/runtime/plugin-runtime/src/core/server/string/index.ts

- packages/runtime/plugin-runtime/src/core/server/string/loadable.ts

- packages/runtime/plugin-runtime/src/exports/loadable.ts

- packages/runtime/plugin-runtime/src/exports/head.ts

- packages/runtime/plugin-runtime/rstest.config.mts

- packages/runtime/plugin-runtime/package.json

- packages/runtime/runtime-extensions/package.json

- packages/runtime/plugin-tanstack/package.json

- pnpm-lock.yaml

- FORK-DIVERGENCE.md

- scripts/ultramodern-boundary-check/divergence-allowlist.json

- scripts/ultramodern-boundary-check/allowlist.json

## Operator Guidance

Owner: `repair-ssr-browser-proofs`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-ssr-browser-proofs](um-parallel-20260909-audit-ssr-browser-proofs.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run all reserved suites at their lawful destinations. Preserve bundled chunkLoadingGlobal behavior, exactly-once cleanup/cancellation, redirects/headers, script ordering and escaping, federated CSS escaping, Helmet collection and callable loadable CJS interop.

- Use the existing real Rspack hydration bundle proof in addition to unit mocks. Report unchanged or stronger assertions and no loss of test discovery when old paths are deleted.

Stop condition: Every reserved regression identity is accounted for and remains executable against the final owning implementation. Tests cannot pass by deleting assertions, weakening selectors or keeping copied framework logic in fixtures.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
