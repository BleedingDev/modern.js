---
name: um-parallel-20260909-repair-cli-rsc-harness
overview: "Own build-time runtime entry contracts and their regression fixtures, plus the shared runtime test/type configuration identity. Coordinate configuration patches centrally instead of having every module worker edit the same harness."
todos:
  - id: repair-cli-rsc-harness-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-cli-rsc-harness-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-cli-rsc-harness-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Runtime CLI generation, RSC boundary and test harness

## Execution Notes

Tracking: `modernjs-cdhz.29.10`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Own build-time runtime entry contracts and their regression fixtures, plus the shared runtime test/type configuration identity. Coordinate configuration patches centrally instead of having every module worker edit the same harness.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/runtime/plugin-runtime/rstest.config.mts`
- `packages/runtime/plugin-runtime/scripts/gen-static.ts`
- `packages/runtime/plugin-runtime/src/cli/registry.ts`
- `packages/runtime/plugin-runtime/src/document/cli/index.ts`
- `packages/runtime/plugin-runtime/src/router/cli/nestedRoutesSpec.ts`
- `packages/runtime/plugin-runtime/src/rsc/server.worker.ts`
- `packages/runtime/plugin-runtime/tests/registrySurface.test.ts`
- `packages/runtime/plugin-runtime/tests/router/cliExtension.test.ts`
- `packages/runtime/plugin-runtime/tests/router/fixtures/rsc-build-entry.ts`
- `packages/runtime/plugin-runtime/tests/router/rsc-build-boundary.test.ts`
- `packages/runtime/plugin-runtime/tests/router/rsc-router.test.tsx`
- `packages/runtime/plugin-runtime/tsconfig.tsgo.json`

Local seam prerequisites:

- Read-only route audit can start immediately from recorded identities; reconcile against the selected integration head before accepting file dispositions. Source writes require this shard's own evidence-backed lawful route and exact source/destination reservation, not completion of a global ownership wave.

- Audit actual CLI router entry/handler hooks, atomic nested-routes spec writes, document bundler hooks and RSC worker entry/export conditions before writes. Coordinate app-tools/build owner only for those actual seams.

- Reconcile absent packages/runtime/plugin-runtime/scripts/gen-static.ts against baseline provenance and any rename/deletion; absence does not discharge its audited identity or confer permission to recreate generated files.

- Prove legal per-file treatment for document/cli/index.ts, rstest.config.mts and gen-static.ts; any required upstream CLI seam beyond the 20-line complete-PR allowance has a real external acceptance dependency. Other shards may run existing tests before harness integration.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/runtime/plugin-runtime/rstest.config.mts`
- `packages/runtime/plugin-runtime/scripts/gen-static.ts`
- `packages/runtime/plugin-runtime/src/cli/registry.ts`
- `packages/runtime/plugin-runtime/src/document/cli/index.ts`
- `packages/runtime/plugin-runtime/src/router/cli/nestedRoutesSpec.ts`
- `packages/runtime/plugin-runtime/src/rsc/server.worker.ts`
- `packages/runtime/plugin-runtime/tests/registrySurface.test.ts`
- `packages/runtime/plugin-runtime/tests/router/cliExtension.test.ts`
- `packages/runtime/plugin-runtime/tests/router/fixtures/rsc-build-entry.ts`
- `packages/runtime/plugin-runtime/tests/router/rsc-build-boundary.test.ts`
- `packages/runtime/plugin-runtime/tests/router/rsc-router.test.tsx`
- `packages/runtime/plugin-runtime/tsconfig.tsgo.json`

Prospective destinations (not write grants):

Fork-owned CLI/runtime integration behind proved native CLI generator hooks; retain necessary native entrypoint contracts. Own rstest.config.mts and tsconfig.tsgo.json inventory identities and collect other shards' harness requirements. Do not hand-edit generated outputs.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- packages/runtime/plugin-runtime/src/router/cli/index.ts

- packages/runtime/plugin-runtime/src/router/cli/handler.ts

- packages/runtime/plugin-runtime/src/router/cli/entry.ts

- packages/runtime/plugin-runtime/src/router/runtime/rsc-router.tsx

- packages/runtime/render/src/rsc.worker.ts

- packages/runtime/plugin-runtime/rstest.config.mts

- packages/runtime/plugin-runtime/package.json

- packages/runtime/runtime-extensions/package.json

- packages/runtime/plugin-tanstack/package.json

- pnpm-lock.yaml

- FORK-DIVERGENCE.md

- scripts/ultramodern-boundary-check/divergence-allowlist.json

- scripts/ultramodern-boundary-check/allowlist.json

## Operator Guidance

Owner: `repair-cli-rsc-harness`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-cli-rsc-harness](um-parallel-20260909-audit-cli-rsc-harness.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Run registry surface, router CLI extension, RSC build boundary and RSC router payload suites; compile actual RSC on/off fixtures and verify worker/browser/Node export resolution.

- Validate atomic nested-routes updates and unchanged native route generation. Run affected runtime test environments and type checks after consolidating harness patches, without excluding failures or changing app config to conceal framework defects.

Stop condition: Every reserved CLI/RSC/config identity, including the absent generator identity, has accounted provenance and lawful disposition. Shared harness consumes module handoffs once; unresolved upstream hooks block only dependent writes/integration.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
