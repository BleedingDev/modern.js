---
name: um-parallel-20260909-repair-ssr-request-lifecycle
overview: "Move fork-owned request/response and cleanup policy to its legal owner while preserving native response status, redirects, headers and cleanup lifetime across string and streamed responses."
todos:
  - id: repair-ssr-request-lifecycle-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-ssr-request-lifecycle-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-ssr-request-lifecycle-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: SSR response projection and router cleanup lifetime

## Execution Notes

Tracking: `modernjs-cdhz.29.18`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Move fork-owned request/response and cleanup policy to its legal owner while preserving native response status, redirects, headers and cleanup lifetime across string and streamed responses.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-runtime/src/core/server/requestResponse.ts`
- `packages/runtime/plugin-runtime/src/core/server/routerCleanup.ts`
- `packages/runtime/plugin-runtime/tests/ssr/serverRender/requestHandler.test.tsx`

Local seam prerequisites:

- Start immediately with an independent read-only audit of these exact identities, audited-base ancestry, full eventual-PR added-plus-removed deltas, current callers and native extension points. No other shard completion is needed for this audit. Writes require only this shard's evidence-backed legal route and the specific interfaces it consumes. Fork-created behavior must move to genuinely fork-owned packages. Audited identities remain governed across moves; each complete-PR patch is capped at 20 added-plus-removed lines and each accepted non-shrink requires the same-PR ledger. If the legal behavior-preserving route needs a neutral upstream seam, prepare the handoff and wait for actual authorized upstream work; do not assume a proposal is merged.

- runtime-router interface only: getRouterServerSnapshot/getRouterRuntimeState, native redirects and cleanup lifecycle; server owner interface only: native request-handler integration and error reporting. No dependency on completion of HTML, streaming or RSC shards.

- Before caller integration, establish an existing lawful request-handler seam or the exact required upstream proposal. Request-handler tests do not prove that such a seam already exists.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-runtime/src/core/server/requestResponse.ts`
- `packages/runtime/plugin-runtime/src/core/server/routerCleanup.ts`
- `packages/runtime/plugin-runtime/tests/ssr/serverRender/requestHandler.test.tsx`

Prospective destinations (not write grants):

Own only these three inventory identities and subsequently reserved fork-owned request-lifecycle destinations. Keep requestResponse and routerCleanup together because response finalization delegates body/discard/error lifetime to the cleanup contract.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Packaging owner: packages/runtime/plugin-runtime/package.json, packages/runtime/render/package.json, packages/runtime/runtime-extensions/package.json and their export maps; send exact proposed edits without writing these shared files.

- Integration owner: pnpm-lock.yaml, package cohort/release identity files, FORK-DIVERGENCE.md and scripts/ultramodern-boundary-check/divergence-allowlist.json; provide identity-preserving evidence and exact patches, never increase allowances locally.

- Destination source/test files in packages/runtime/runtime-extensions must receive an exact disjoint reservation before extraction writes; its shared entrypoints stay with their designated integration owner.

- packages/runtime/plugin-runtime/src/core/server/requestHandler.tsx is outside this exact inventory reservation; hand off its required caller changes to a designated integration/upstream owner with audited identity and complete-PR delta evidence.

- runtime-router owner receives changes needed in router/runtime lifecycle or redirect files; server owner receives server adapter integration patches.

- ssr-streaming receives response-body ownership and cancellation contract; neither worker edits the other's files.

## Operator Guidance

Owner: `repair-ssr-request-lifecycle`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-ssr-request-lifecycle](um-parallel-20260909-audit-ssr-request-lifecycle.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Focused requestHandler coverage for loader and RSC redirects, null-body statuses, merged headers, router status/error projection and response discard.

- Exercise cleanup exactly once after normal body exhaustion, explicit cancellation, render failure and body-reader failure, preserving original error reporting.

- Use native Node/workerd request/response behavior and the same runtime identity; report extraction deletion map and canonical boundary evidence.

Stop condition: Stop this shard's affected writes when its route exceeds the audited-file 20-line complete-PR cap, requires an unavailable upstream seam or lacks a reserved destination/interface; continue its independent read-only audit. Finish only with an exact deletion/move/retention map, no residual assigned violations or governed edges, relevant behavior evidence and complete-PR/cumulative identity deltas. Do not claim release readiness from source mocks or a prepared upstream proposal.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
