---
name: um-parallel-20260909-repair-bff-request
overview: "Keep request policy, context, trace propagation, request factory and transport in one owner; trace the active allowlisted plugin-bff create-request edge to the real runtime owner and remove the governed dependency without alias or marker hiding."
todos:
  - id: repair-bff-request-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-bff-request-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-bff-request-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Outbound request factory, transport resilience and identity context

## Execution Notes

Tracking: `modernjs-cdhz.29.46`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Keep request policy, context, trace propagation, request factory and transport in one owner; trace the active allowlisted plugin-bff create-request edge to the real runtime owner and remove the governed dependency without alias or marker hiding.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/cli/plugin-bff/src/runtime/create-request/index.ts`
- `packages/server/create-request/src/policyCore.ts`
- `packages/server/create-request/src/requestContext.ts`
- `packages/server/create-request/src/requestFactory.ts`
- `packages/server/create-request/src/traceparent.ts`
- `packages/server/create-request/src/transport.ts`
- `packages/server/create-request/src/utiles.ts`
- `packages/server/create-request/tests/acceptHeader.test.ts`
- `packages/server/create-request/tests/browser-get-body.test.ts`
- `packages/server/create-request/tests/identityBinding.test.ts`
- `packages/server/create-request/tests/policyCore.test.ts`
- `packages/server/create-request/tests/requestContext.test.ts`
- `packages/server/create-request/tests/requestFactory.outbound-contract.test.ts`
- `packages/server/create-request/tests/traceparent.test.ts`
- `packages/server/create-request/tests/transport-retry.test.ts`
- `packages/server/create-request/tsconfig.json`

Local seam prerequisites:

- Start this shard with an independent read-only route audit against the regenerated integration baseline; no completed sibling or global ownership wave is needed for that audit. Source writes require this shard's per-identity legal route, exact destination reservation and required interface to be approved/frozen. Audited identities retain provenance across moves and the complete eventual PR adds+removes cap of 20 per file, including PR49; prepare a real upstream proposal if a lawful local route cannot fit. Proposal-based development is isolated and integration/release waits for actual upstream landing and valid provenance carry-forward.

- Before writes, freeze native request creator/environment, context snapshot/header, protected identity and operation-contract contracts with bff-policy-adapters; freeze browser/Node conditional entry requirements with bff-effect-runtime and packaging. Trace create-request existing client/server/types/index callers before authorizing any change outside this exact inventory.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/cli/plugin-bff/src/runtime/create-request/index.ts`
- `packages/server/create-request/src/policyCore.ts`
- `packages/server/create-request/src/requestContext.ts`
- `packages/server/create-request/src/requestFactory.ts`
- `packages/server/create-request/src/traceparent.ts`
- `packages/server/create-request/src/transport.ts`
- `packages/server/create-request/src/utiles.ts`
- `packages/server/create-request/tests/acceptHeader.test.ts`
- `packages/server/create-request/tests/browser-get-body.test.ts`
- `packages/server/create-request/tests/identityBinding.test.ts`
- `packages/server/create-request/tests/policyCore.test.ts`
- `packages/server/create-request/tests/requestContext.test.ts`
- `packages/server/create-request/tests/requestFactory.outbound-contract.test.ts`
- `packages/server/create-request/tests/traceparent.test.ts`
- `packages/server/create-request/tests/transport-retry.test.ts`
- `packages/server/create-request/tsconfig.json`

Prospective destinations (not write grants):

The five fork-created create-request implementation modules and their tests move together to a genuinely fork-owned request submodule/package selected by route audit. Prefer a protocol-neutral/browser-safe owner; do not force non-Effect consumers to import Effect merely to obtain request transport. Preserve native Node/browser request selection using a proven extension point or actual upstream fix. Audited utiles.ts, tsconfig.json and the import-only runtime/create-request/index.ts keep their own provenance/routes.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Shared-file integration owners receive exact patches for package.json manifests/exports, package entrypoint export aggregation, rslib build entry lists, pnpm-lock.yaml, release cohort and FORK-DIVERGENCE.md. Do not write these concurrently. Boundary/provenance owner handles divergence-allowlist.json and import allowlist.json from evidence; no cap reset or renamed marker.

- packages/server/create-request/src/types.ts, client.ts, server.ts and index.ts (if those exact files exist at execution) are outside the assigned inventory: discover actual caller paths and hand off per-file legal proposals rather than silently claiming package-wide ownership. Native condition-selecting entrypoints may require upstream landing.

- packages/server/bff-effect/src/effect/operation-context.ts, src/effect-client/index.ts and src/data-platform/trace.ts are integrated by bff-effect-runtime from this shard's exact request-contract patch. Toolkit owns shared identity/header types when applicable. Packaging owns conditional exports and dependency routing.

## Operator Guidance

Owner: `repair-bff-request`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-bff-request](um-parallel-20260909-audit-bff-request.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Account for each assigned identity with old/new ownership and deletion/retention map; report full-PR and cumulative audited hunks/lines. Run the complete canonical boundary and imports scans on integration, tracking unrelated failures separately during shard work; no residual assigned governed edge or duplicate implementation may be hidden. Preserve existing assertions when relocating tests.

- Relocate/run acceptHeader, browser-get-body, identityBinding, policyCore, requestContext, requestFactory.outbound-contract, traceparent and transport-retry suites; verify browser and Node request bodies/uploads, protected identity precedence, origin/domain policy, trace propagation, retries/cancellation and operation metadata. Test actual browser/server entry selection and prove the current allowlisted @modern-js/create-request edge is gone because ownership was repaired.

Stop condition: Stop source work on any unproved route, target collision, over-cap audited patch or missing interface and return exact evidence to its owner; independent audits and unrelated lawful work continue. Complete this shard only when all assigned paths have proven lawful dispositions, focused behavior checks pass, shared patches are handed off and any required upstream landing is recorded as an unresolved integration dependency until it actually lands.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
