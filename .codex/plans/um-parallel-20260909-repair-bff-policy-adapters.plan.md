---
name: um-parallel-20260909-repair-bff-policy-adapters
overview: "Keep policy normalization/enforcement, operation contracts, adapter-kit scenarios and Effect/Hono parity under one owner. Preserve consumer protocol freedom, schema validation, identity binding and data ownership without requiring an app-level compatibility layer."
todos:
  - id: repair-bff-policy-adapters-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-bff-policy-adapters-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-bff-policy-adapters-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Cross-project policy, operation contracts and protocol adapter parity

## Execution Notes

Tracking: `modernjs-cdhz.29.44`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Keep policy normalization/enforcement, operation contracts, adapter-kit scenarios and Effect/Hono parity under one owner. Preserve consumer protocol freedom, schema validation, identity binding and data ownership without requiring an app-level compatibility layer.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/cli/plugin-bff/tests/effect-cross-project-policy.test.ts`
- `packages/cli/plugin-bff/tests/hono-adapter-parity.test.ts`
- `packages/cli/plugin-bff/tests/honoAdapter.test.ts`
- `packages/server/bff-core/src/adapter-kit/index.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/cross-project-denial.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/envelope.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/operation-context.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/schema.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/shared.ts`
- `packages/server/bff-core/src/adapter-kit/parity.ts`
- `packages/server/bff-core/src/security/crossProjectPolicy.ts`
- `packages/server/bff-core/src/security/operationContracts.ts`
- `packages/server/bff-core/src/security/resolveCrossProjectPolicy.ts`
- `packages/server/bff-core/tests/adapterKit.test.ts`
- `packages/server/bff-core/tests/crossProjectPolicy.matrix.test.ts`
- `packages/server/bff-core/tests/crossProjectPolicy.test.ts`
- `packages/server/bff-core/tests/fixtures/upload/lambda/index.ts`
- `packages/server/bff-core/tests/operationContracts.test.ts`
- `packages/server/bff-core/tests/operators/http.matrix.test.ts`
- `packages/server/bff-core/tests/optionalZodPeer.test.ts`
- `packages/server/bff-core/tests/resolveCrossProjectPolicy.test.ts`
- `packages/server/bff-core/tests/schemaMarkerContract.test.ts`
- `packages/server/bff-core/tsconfig.json`

Local seam prerequisites:

- Start this shard with an independent read-only route audit against the regenerated integration baseline; no completed sibling or global ownership wave is needed for that audit. Source writes require this shard's per-identity legal route, exact destination reservation and required interface to be approved/frozen. Audited identities retain provenance across moves and the complete eventual PR adds+removes cap of 20 per file, including PR49; prepare a real upstream proposal if a lawful local route cannot fit. Proposal-based development is isolated and integration/release waits for actual upstream landing and valid provenance carry-forward.

- Before writes, freeze policy normalization and operation-contract data interfaces shared with bff-request, bff-client-generation and bff-effect-runtime; security decisions and protected headers must agree at inbound/outbound seams. Existing policy and native adapter entrypoints must be traced before choosing the destination.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/cli/plugin-bff/tests/effect-cross-project-policy.test.ts`
- `packages/cli/plugin-bff/tests/hono-adapter-parity.test.ts`
- `packages/cli/plugin-bff/tests/honoAdapter.test.ts`
- `packages/server/bff-core/src/adapter-kit/index.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/cross-project-denial.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/envelope.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/operation-context.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/schema.ts`
- `packages/server/bff-core/src/adapter-kit/parity-scenarios/shared.ts`
- `packages/server/bff-core/src/adapter-kit/parity.ts`
- `packages/server/bff-core/src/security/crossProjectPolicy.ts`
- `packages/server/bff-core/src/security/operationContracts.ts`
- `packages/server/bff-core/src/security/resolveCrossProjectPolicy.ts`
- `packages/server/bff-core/tests/adapterKit.test.ts`
- `packages/server/bff-core/tests/crossProjectPolicy.matrix.test.ts`
- `packages/server/bff-core/tests/crossProjectPolicy.test.ts`
- `packages/server/bff-core/tests/fixtures/upload/lambda/index.ts`
- `packages/server/bff-core/tests/operationContracts.test.ts`
- `packages/server/bff-core/tests/operators/http.matrix.test.ts`
- `packages/server/bff-core/tests/optionalZodPeer.test.ts`
- `packages/server/bff-core/tests/resolveCrossProjectPolicy.test.ts`
- `packages/server/bff-core/tests/schemaMarkerContract.test.ts`
- `packages/server/bff-core/tsconfig.json`

Prospective destinations (not write grants):

Exclusive existing fork adapters packages/cli/plugin-bff-extensions/src/cross-project-policy/, src/effect-adapter/ and src/hono/, with matching tests. Route audit must choose a genuine fork-owned protocol-neutral home for bff-core security/adapter-kit (a dedicated subpath/package if existing bff-effect exports cannot stay free of mandatory Effect runtime coupling); reserve exact destinations before writes. No automatic authorization for a new package or expansion of vanilla bff-core.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Shared-file integration owners receive exact patches for package.json manifests/exports, package entrypoint export aggregation, rslib build entry lists, pnpm-lock.yaml, release cohort and FORK-DIVERGENCE.md. Do not write these concurrently. Boundary/provenance owner handles divergence-allowlist.json and import allowlist.json from evidence; no cap reset or renamed marker.

- packages/server/bff-core/src/index.ts and existing operator/schema/security export aggregators are not assigned here; exact caller/export changes need their own legal reservation via integration. Audited honoAdapter.test.ts has measured 67 cumulative changed lines versus budget 5; do not assume restoring/moving the test fits the complete-PR cap.

- packages/server/runtime-extensions/src/backend-federation-security/ needs server-lane coordination for authentication/operation-envelope contracts; provide exact patches. bff-effect-runtime owns the dispatcher and operation-context source; policy owner supplies the adapter contract and dispatch-side patch.

- Core tsconfig changes are owned here; they cannot absorb new fork implementation or suppress diagnostics. Relocate operator/schema/optional-peer tests as retained protocol acceptance, not as justification to copy audited core implementation.

## Operator Guidance

Owner: `repair-bff-policy-adapters`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-bff-policy-adapters](um-parallel-20260909-audit-bff-policy-adapters.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Account for each assigned identity with old/new ownership and deletion/retention map; report full-PR and cumulative audited hunks/lines. Run the complete canonical boundary and imports scans on integration, tracking unrelated failures separately during shard work; no residual assigned governed edge or duplicate implementation may be hidden. Preserve existing assertions when relocating tests.

- Relocate/run adapterKit, all crossProjectPolicy/resolveCrossProjectPolicy/operationContracts suites, HTTP input matrix/upload fixture/schema marker/optional Zod checks, Effect cross-project policy, Hono parity and audited Hono adapter checks. Include allow/deny/malformed-policy and missing peer cases, header/operation-context parity and real adapter dispatch; no weakened emergency-age or ownership policy.

Stop condition: Stop source work on any unproved route, target collision, over-cap audited patch or missing interface and return exact evidence to its owner; independent audits and unrelated lawful work continue. Complete this shard only when all assigned paths have proven lawful dispositions, focused behavior checks pass, shared patches are handed off and any required upstream landing is recorded as an unresolved integration dependency until it actually lands.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
