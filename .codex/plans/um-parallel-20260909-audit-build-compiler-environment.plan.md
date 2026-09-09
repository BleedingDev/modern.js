---
name: um-parallel-20260909-audit-build-compiler-environment
overview: "Own the build-config public API, environment leases and compiler-tool resolution together with Rsbuild option regressions and precompression. They share native builder configuration and lifecycle hooks, but do not require deployment or release-envelope implementation to start."
todos:
  - id: audit-build-compiler-environment-reconcile
    content: "Reconcile every reserved identity and current import against the pinned execution inventory; prove audited/fork ownership, callers and complete-PR capacity without changing source."
    status: pending
  - id: audit-build-compiler-environment-route
    content: "Prove a behavior-preserving lawful route and only the native interfaces this shard consumes. Prepare a bounded seam packet for unresolved upstream needs; do not treat an unknown route as approved."
    status: pending
  - id: audit-build-compiler-environment-grant
    content: "Obtain the integration owner’s exact source/destination reservation and accepted peer interface contracts. Release only this shard when all write prerequisites are real; unresolved rows remain blocked and are registered with explicit dependency edges."
    status: pending
isProject: false
---

# Audit: Compiler environment, native build options and precompression

## Execution Notes

Tracking: `modernjs-cdhz.29.49`. Mode: **read-only**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Own the build-config public API, environment leases and compiler-tool resolution together with Rsbuild option regressions and precompression. They share native builder configuration and lifecycle hooks, but do not require deployment or release-envelope implementation to start.

Required output: Per-identity legal route, caller/seam evidence, complete-PR capacity and one exact source/destination ownership packet for build-compiler-environment.

Read-only input identities:

- `packages/cli/builder/tests/fixtures/postcss-user-config/postcss.config.cjs`
- `packages/cli/builder/tests/postcss.test.ts`
- `packages/cli/builder/tests/reactCompiler.test.ts`
- `packages/cli/builder/tests/rsdoctor.test.ts`
- `packages/cli/builder/tests/tsgo.test.ts`
- `packages/solutions/app-tools/src/builder/shared/builderPlugins/adapterPrecompress.ts`
- `packages/solutions/app-tools/src/config/build-environment.ts`
- `packages/solutions/app-tools/src/config/public.ts`
- `packages/solutions/app-tools/src/types/config/precompress.ts`
- `packages/solutions/app-tools/tests/builder/adapterPrecompress.test.ts`
- `packages/solutions/app-tools/tests/config/build-environment.test.ts`
- `packages/solutions/app-tools/tests/config/public-surface-consumer.ts`
- `packages/solutions/app-tools/tests/config/public-surface-private-create-default-consumer.ts`
- `packages/solutions/app-tools/tests/config/public-surface-private-initial-config-consumer.ts`
- `packages/solutions/app-tools/tests/config/public-surface-private-set-environment-consumer.ts`
- `packages/solutions/app-tools/tests/config/tsconfig.public-surface-consumer.json`
- `packages/solutions/app-tools/tests/config/verify-public-surface.mjs`

Local seam prerequisites:

- Audit: none; inspect native Rsbuild configuration and lifecycle extension points independently.

- Writes: this shard's legal-route audit and the exact public build-config API contract needed by generated-surface consumers. Existing Rsbuild plugin/lifecycle contracts can be used immediately after local audit; no blanket dependency on build-preset-release or the complete ownership-contract lane.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

No framework source write grant. Evidence uses a node-private file or artifact root assigned by the operator.

Prospective destinations (not write grants):

- Prospective fork module packages/solutions/app-tools-extensions/src/build-config/ and tests/build-config/ for environment/compiler/public-surface behavior.

- Prospective fork module packages/solutions/app-tools-extensions/src/build-config/precompress/ for the Rsbuild compression plugin and its types.

Out of scope: Source changes, shared manifests/lockfile/ledger/allowlists, upstream submission and other shards.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Generated-surface owner receives public build-config import/type signatures and migration requirements; packaging integrator owns public export map edits.

- build-preset-release receives option/default and environment-lifetime signatures if its composition calls them; only dependent composition waits for that interface.

- Integrator owns existing and prospective package.json manifests and public export maps; provide exact proposed patches without editing those files.

- Integrator owns pnpm-lock.yaml, release cohort/version metadata, FORK-DIVERGENCE.md and scripts/ultramodern-boundary-check/{divergence-allowlist.json,allowlist.json}; return per-identity evidence and required patches, never shared-file writes.

## Operator Guidance

Owner: `audit-build-compiler-environment`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [gate-baseline-freeze](um-parallel-20260909-gate-baseline-freeze.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Read-only audit may start immediately: regenerate owned identity/edge evidence against the selected integration head, fixed audited base eded841256a7cffdaa622e3889fc83407debd3e4 and actual complete PR merge range, including prior unmerged work. Classify fork additions versus audited identities; prove the native extension route or record the exact upstream blocker.

- After later implementation authorization, run focused existing behavior tests plus the listed real-output regressions, record deletion/move/retention and complete-PR/cumulative added-plus-removed line and hunk counts, and hand integration the evidence for the full canonical divergence/import gates. Moving an audited identity never resets its cap.

- Run build-environment concurrency/conflict/release tests, compiler resolution tests, positive public-type consumer and negative private-import probes, PostCSS user-config, React compiler, rsdoctor, tsgo and precompression behavior tests. Verify user Rsbuild/Rspack overrides and real compressed outputs; use separate processes for tests mutating process environment or cwd.

Stop condition: Every assigned identity has a lawful disposition; environment leases clean up on success/failure/watch shutdown, compiler selection and user overrides remain correct, and generated consumers import only the intended public API. No config suppression masks a framework error.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
