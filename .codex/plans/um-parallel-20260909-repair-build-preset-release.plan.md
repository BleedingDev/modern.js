---
name: um-parallel-20260909-repair-build-preset-release
overview: "Own the import-only app-tools entrypoint together with preset forwarding/composition and release integration tests so the sole governed build edge is removed through the fork entrypoint. Keep release identity/envelope behavior in its existing fork owner and remove duplicated upstream wrappers."
todos:
  - id: repair-build-preset-release-implement
    content: "Implement the accepted per-identity routes in the exact granted source and fork-owned destination files; remove duplicated old implementations and eliminate this shard’s governed import edges."
    status: pending
  - id: repair-build-preset-release-verify
    content: "Run focused behavior and negative regressions appropriate to this module, check complete-PR cap/ledger obligations, and distinguish locally proven behavior from final integrated artifact qualification."
    status: pending
  - id: repair-build-preset-release-handoff
    content: "Return reviewed source changes, exact shared manifest/export/ledger patches and identity accounting to their sole integration owner; unblock successors immediately without waiting for unrelated component workers."
    status: pending
isProject: false
---

# Repair: Native preset composition and release-envelope integration

## Execution Notes

Tracking: `modernjs-cdhz.29.60`. Mode: **write-capable**. Read [the parallel program](um-parallel-20260909-overview.md) and [the unchanged acceptance contract](um-zero-20260909-overview.md). This is a deferred execution plan; creating it does not perform its tasks.

Own the import-only app-tools entrypoint together with preset forwarding/composition and release integration tests so the sole governed build edge is removed through the fork entrypoint. Keep release identity/envelope behavior in its existing fork owner and remove duplicated upstream wrappers.

Required output: Complete scoped patch plus identity/import disposition map, shared-file handoffs and concrete focused-test evidence.

Read-only input identities:

- `packages/solutions/app-tools/src/index.ts`
- `packages/solutions/app-tools/src/plugins/ultramodernReleaseEnvelope.ts`
- `packages/solutions/app-tools/src/presetUltramodern.ts`
- `packages/solutions/app-tools/tests/index.test.ts`
- `packages/solutions/app-tools/tests/presetUltramodern.test.ts`
- `packages/solutions/app-tools/tests/ultramodern-release-envelope-integration.test.ts`
- `packages/solutions/app-tools/tests/ultramodern-release-envelope.test.ts`
- `packages/solutions/app-tools/tests/ultramodern-release-identity.test.ts`

Local seam prerequisites:

- Audit: none; independently prove removal of packages/solutions/app-tools/src/index.ts -> ./presetUltramodern without losing native composition.

- Writes: this shard's legal-route audit; exact required build-config option signatures, backend artifact identity/schema and deployment resolveDeployTarget/staging contracts. Only call sites consuming changed contracts wait for their respective handoffs; existing stable signatures permit independent work.

## Constraints

You are not alone in the codebase. Preserve other owners’ changes. Every worker is a leaf; only the primary agent schedules new nodes. Current planning authorization grants no framework changes or release.

Reserved file scope:

- `packages/solutions/app-tools/src/index.ts`
- `packages/solutions/app-tools/src/plugins/ultramodernReleaseEnvelope.ts`
- `packages/solutions/app-tools/src/presetUltramodern.ts`
- `packages/solutions/app-tools/tests/index.test.ts`
- `packages/solutions/app-tools/tests/presetUltramodern.test.ts`
- `packages/solutions/app-tools/tests/ultramodern-release-envelope-integration.test.ts`
- `packages/solutions/app-tools/tests/ultramodern-release-envelope.test.ts`
- `packages/solutions/app-tools/tests/ultramodern-release-identity.test.ts`

Prospective destinations (not write grants):

- Prospective fork module packages/solutions/app-tools-extensions/src/native-composition/ and tests/native-composition/ for preset/native CLI plugin composition.

- Existing release-identity and release-envelope fork submodules are consumed through their public contracts; any required changes are reserved with integration before writing.

Out of scope: Other source reservations, shared manifests/lockfile/ledger/allowlists, unapproved destinations, upstream submission, consumer shims and generated output edits.

Exact new destinations, source-barrel transfers and consumed interface deliveries must be recorded before writes. An audit report containing unresolved rows is not a completed route gate. Required upstream seams become explicit per-seam graph nodes/edges; an unmerged proposal cannot satisfy a landing prerequisite. Revalidate the exact selection after any expansion.

Keep fixed audited identity and full canonical scope, the complete-PR 20-line cap per audited file, required same-PR ledger and native extension ownership. No allowance reset, hidden imports, marker/identity renaming, app shim, copied framework wrapper, generated-file hand edit or hook bypass.

Shared-owner handoffs:

- Integrator owns the fork public entrypoint/export map and removes the active ./presetUltramodern allowance plus stale ./plugins/ultramodernReleaseEnvelope allowance only after real repairs.

- Generated-surface/native-usage owners receive the native fork composition imports and supported options; BFF owner receives release-envelope integration plugin fixture needs.

- build-deploy-output owns Cloudflare deployment tests; this shard owns ultramodern-release-envelope-integration.test.ts and related release tests, preventing fixture/write overlap.

- Integrator owns existing and prospective package.json manifests and public export maps; provide exact proposed patches without editing those files.

- Integrator owns pnpm-lock.yaml, release cohort/version metadata, FORK-DIVERGENCE.md and scripts/ultramodern-boundary-check/{divergence-allowlist.json,allowlist.json}; return per-identity evidence and required patches, never shared-file writes.

## Operator Guidance

Owner: `repair-build-preset-release`. Completion updates this plan and its exact br issue only after evidence is reviewed. Never mark a task complete because it is queued, drafted, or blocked.

Dependencies: [audit-build-preset-release](um-parallel-20260909-audit-build-preset-release.plan.md), [gate-shared-service](um-parallel-20260909-gate-shared-service.plan.md)

Resource locks: node-private mutable workspace and artifacts; apply the program’s host/build resource policy.

Verification: - Read-only audit may start immediately: regenerate owned identity/edge evidence against the selected integration head, fixed audited base eded841256a7cffdaa622e3889fc83407debd3e4 and actual complete PR merge range, including prior unmerged work. Classify fork additions versus audited identities; prove the native extension route or record the exact upstream blocker.

- After later implementation authorization, run focused existing behavior tests plus the listed real-output regressions, record deletion/move/retention and complete-PR/cumulative added-plus-removed line and hunk counts, and hand integration the evidence for the full canonical divergence/import gates. Moving an audited identity never resets its cap.

- Run presetUltramodern, index, release identity/envelope and envelope integration tests against the genuine fork entrypoint. Verify user override precedence, endpoint-driven telemetry defaults, MF types/SSR behavior and identical browser/SSR/API/backend delivery-unit identity. Confirm canonical import scan finds no remaining governed app-tools preset edge, including hidden re-exports.

Stop condition: All reserved paths, including the one import-only identity, have legal disposition; native composition and release integration tests pass and the governed edge is actually removed. No app config wrapper or import-marker renaming is accepted.

Dispatch ready nodes continuously, up to 40 active leaf workers under the resolved 50-thread budget. Use immediate per-node handoffs; do not wait for an entire conceptual wave. The primary owns the shared integration service and exact source/receipt reconciliation.
