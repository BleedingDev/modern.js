---
name: um-parallel-20260909-repair-bff-cli
overview: "Keep CLI hook wiring, BFF compile/watch orchestration and server globals together; remove fork-created helpers from upstream plugin-bff without retaining a second generated runtime implementation."
todos:
  - id: repair-bff-cli-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-bff-cli-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-bff-cli-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: BFF CLI orchestration and generated server entry configuration

## Execution Notes

Tracking: `modernjs-cdhz.29.38`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Keep CLI hook wiring, BFF compile/watch orchestration and server globals together; remove fork-created helpers from upstream plugin-bff without retaining a second generated runtime implementation.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/cli/plugin-bff/src/cli.ts`
- `packages/cli/plugin-bff/src/cli/compress.ts`
- `packages/cli/plugin-bff/src/cli/generator.ts`
- `packages/cli/plugin-bff/src/cli/prefix.ts`
- `packages/cli/plugin-bff/src/cli/serverGlobalVars.ts`
- `packages/cli/plugin-bff/src/cli/watch.ts`
- `packages/cli/plugin-bff/tests/generator-global-vars.test.ts`

Local seam prerequisites:

- Start this shard with an independent read-only route audit against the regenerated integration baseline; no completed sibling or global ownership wave is needed for that audit. Source writes require this shard's per-identity legal route, exact destination reservation and required interface to be approved/frozen. Audited identities retain provenance across moves and the complete eventual PR adds+removes cap of 20 per file, including PR49; prepare a real upstream proposal if a lawful local route cannot fit. Proposal-based development is isolated and integration/release waits for actual upstream landing and valid provenance carry-forward.

- Before orchestration writes, freeze native CLI plugin lifecycle/configuration and generator invocation signatures with the build lane; freeze artifact descriptors with bff-client-generation and loader options with bff-effect-runtime. Their implementations may proceed concurrently against those interfaces.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/cli/plugin-bff/src/cli.ts`
- `packages/cli/plugin-bff/src/cli/compress.ts`
- `packages/cli/plugin-bff/src/cli/generator.ts`
- `packages/cli/plugin-bff/src/cli/prefix.ts`
- `packages/cli/plugin-bff/src/cli/serverGlobalVars.ts`
- `packages/cli/plugin-bff/src/cli/watch.ts`
- `packages/cli/plugin-bff/tests/generator-global-vars.test.ts`

Prospective destinations (not write grants):

Proposed exclusive fork destination: packages/cli/plugin-bff-extensions/src/cli/ and matching tests. Existing extension-package cross-project-generation and client-generator belong to bff-client-generation; effect-source-loader and backend-federation belong to bff-effect-runtime. Audited plugin-bff/src/cli.ts remains governed and may require a neutral upstream hook/registration change.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Shared-file integration owners receive exact patches for package.json manifests/exports, package entrypoint export aggregation, rslib build entry lists, pnpm-lock.yaml, release cohort and FORK-DIVERGENCE.md. Do not write these concurrently. Boundary/provenance owner handles divergence-allowlist.json and import allowlist.json from evidence; no cap reset or renamed marker.

- packages/cli/plugin-bff/src/utils/clientGenerator.ts and runtimeGenerator.ts are outside this inventory reservation: caller edits require an exact owner handoff and their own route review, not assumed permission. bff-client-generation owns crossProjectApiPlugin.ts and pluginGenerator.ts.

- bff-effect-runtime owns the mixed regression.test.ts file; supply CLI export/hook assertions as a patch to that owner.

## Operator Guidance

Owner: `repair-bff-cli`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-bff-cli](um-parallel-20260909-audit-bff-cli.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Account for each assigned identity with old/new ownership and deletion/retention map; report full-PR and cumulative audited hunks/lines. Run the complete canonical boundary and imports scans on integration, tracking unrelated failures separately during shard work; no residual assigned governed edge or duplicate implementation may be hidden. Preserve existing assertions when relocating tests.

- Relocate/run generator-global-vars tests; verify native hook order, Effect/Hono selection, generated server globals, compression prefix and watch behavior, and build generated Node/worker entrypoints against frozen interfaces. Confirm generation emits only necessary contract/entry data.

Stop condition: Stop source work on any unproved route, target collision, over-cap audited patch or missing interface and return exact evidence to its owner; independent audits and unrelated lawful work continue. Complete this shard only when all assigned paths have proven lawful dispositions, focused behavior checks pass, shared patches are handed off and any required upstream landing is recorded as an unresolved integration dependency until it actually lands.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
