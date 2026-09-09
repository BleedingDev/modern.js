---
name: um-parallel-20260909-audit-bff-effect-runtime
overview: "Keep native Effect loading, API entry shape, conditional runtime entrypoints and backend-federation acceptance in one coupled runtime owner so moving compatibility exports cannot split singleton identity or backend delivery identity."
todos:
  - id: audit-bff-effect-runtime-reconcile
    content: "Reconcile every reserved identity and current import against the pinned execution inventory; prove audited/fork ownership, callers and complete-PR capacity without changing source."
    status: pending
  - id: audit-bff-effect-runtime-route
    content: "Prove a behavior-preserving lawful route and only the native interfaces this shard consumes. Prepare a bounded seam packet for unresolved upstream needs; do not treat an unknown route as approved."
    status: pending
  - id: audit-bff-effect-runtime-grant
    content: "Obtain the integration owner’s exact source/destination reservation and accepted peer interface contracts. Release only this shard when all write prerequisites are real; unresolved rows remain blocked and are registered with explicit dependency edges."
    status: pending
isProject: false
---

# Audit: Effect source loading, public runtime surfaces and backend federation

## Execution Notes

Tracking: `modernjs-cdhz.29.41`. Mode: **read-only**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Keep native Effect loading, API entry shape, conditional runtime entrypoints and backend-federation acceptance in one coupled runtime owner so moving compatibility exports cannot split singleton identity or backend delivery identity.

Required output: Per-identity legal route, caller/seam evidence, complete-PR capacity and one exact source/destination ownership packet for bff-effect-runtime.

Read-only input identities:

- `packages/cli/plugin-bff/src/loader.ts`
- `packages/cli/plugin-bff/src/runtime/data-platform/index.ts`
- `packages/cli/plugin-bff/src/runtime/effect-client/index.ts`
- `packages/cli/plugin-bff/src/runtime/effect-client/runtime.ts`
- `packages/cli/plugin-bff/src/runtime/effect/edge-dispatcher.ts`
- `packages/cli/plugin-bff/src/runtime/effect/edge.ts`
- `packages/cli/plugin-bff/src/runtime/effect/index.ts`
- `packages/cli/plugin-bff/tests/backend-federation-compatibility.test.ts`
- `packages/cli/plugin-bff/tests/built-edge-package-surface.test.ts`
- `packages/cli/plugin-bff/tests/effect-edge-runtime.test.ts`
- `packages/cli/plugin-bff/tests/effect-server-integration.test.ts`
- `packages/cli/plugin-bff/tests/effect-source-loader.test.ts`
- `packages/cli/plugin-bff/tests/optional-effect-peer.test.ts`
- `packages/cli/plugin-bff/tests/package-surface.test.ts`
- `packages/cli/plugin-bff/tests/pure-runtime-compatibility.test.ts`
- `packages/cli/plugin-bff/tests/regression.test.ts`
- `packages/server/bff-runtime/tsconfig.json`

Local seam prerequisites:

- Start this shard with an independent read-only route audit against the regenerated integration baseline; no completed sibling or global ownership wave is needed for that audit. Source writes require this shard's per-identity legal route, exact destination reservation and required interface to be approved/frozen. Audited identities retain provenance across moves and the complete eventual PR adds+removes cap of 20 per file, including PR49; prepare a real upstream proposal if a lawful local route cannot fit. Proposal-based development is isolated and integration/release waits for actual upstream landing and valid provenance carry-forward.

- Before writes, freeze upstream loader-extension option and return contracts; retain the original audited identity of plugin-bff/src/loader.ts. Freeze bff-policy-adapters policy/operation-context adapter interface and bff-client-generation API export contract. Server lane supplies the native ServerPlugin assembly contract; a required upstream seam must actually land before integration.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Prospective destinations (not write grants):

Exclusive runtime implementation reservations after route audit: packages/cli/plugin-bff-extensions/src/effect-source-loader/, src/backend-federation/, src/backend-federation-manifest/, and packages/server/bff-effect/src/effect/ except shared operation-context.ts handoff below. This shard owns relocation of Effect/client/data-platform compatibility surfaces and associated acceptance tests; aggregate exports/manifests go through packaging. Existing bff-effect src/effect-client/ and src/data-platform/ are consumers, not permission to rewrite those entire modules.

Out of scope: Source changes, shared manifests/lockfile/ledger/allowlists, upstream submission and other shards.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Shared-file integration owners receive exact patches for package.json manifests/exports, package entrypoint export aggregation, rslib build entry lists, pnpm-lock.yaml, release cohort and FORK-DIVERGENCE.md. Do not write these concurrently. Boundary/provenance owner handles divergence-allowlist.json and import allowlist.json from evidence; no cap reset or renamed marker.

- packages/server/bff-effect/src/effect/operation-context.ts, src/effect-client/index.ts and src/data-platform/trace.ts consume create-request contracts: bff-request supplies exact changes; this runtime owner integrates them after request interface freeze. Avoid concurrent bff-effect src/effect edits.

- packages/cli/plugin-bff-extensions/src/effect-adapter/ and src/hono/ belong to bff-policy-adapters; send dispatch/registration changes to that owner. packages/server/runtime-extensions/src/backend-federation-security/ is shared with the server lane: provide an exact contract/patch, never take the whole server-runtime-extensions package.

- Own the complete mixed regression.test.ts rather than divide one file among workers; collect bff-cli, generation and policy assertions. Packaging owns package-condition maps; this shard supplies required runtime/browser export identities and built-condition tests.

## Operator Guidance

Owner: `audit-bff-effect-runtime`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-baseline-freeze](um-parallel-20260909-gate-baseline-freeze.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Account for each assigned identity with old/new ownership and deletion/retention map; report full-PR and cumulative audited hunks/lines. Run the complete canonical boundary and imports scans on integration, tracking unrelated failures separately during shard work; no residual assigned governed edge or duplicate implementation may be hidden. Preserve existing assertions when relocating tests.

- Relocate/run effect-source-loader, effect-edge-runtime, effect-server-integration, backend-federation-compatibility, built-edge-package-surface, optional-effect-peer, package-surface, pure-runtime-compatibility and regression suites; include actual Node/workerd bundles and optional-peer-negative checks. Assert native HttpApi/HttpApiBuilder object identity across host/remote and Node/worker entrypoints, browser exclusion of server-only modules, and rejection of mismatched complete delivery-unit API/backend identities.

Stop condition: Stop source work on any unproved route, target collision, over-cap audited patch or missing interface and return exact evidence to its owner; independent audits and unrelated lawful work continue. Complete this shard only when all assigned paths have proven lawful dispositions, focused behavior checks pass, shared patches are handed off and any required upstream landing is recorded as an unresolved integration dependency until it actually lands.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
