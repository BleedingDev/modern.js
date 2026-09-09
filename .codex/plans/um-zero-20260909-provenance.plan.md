---
name: um-zero-20260909-provenance
overview: "Implement reviewed upstream provenance carry-forward. scripts/ultramodern-boundary-check provenance validation/writer tests and reviewed design; actual application reserved to packaging/integration."
todos:
  - id: zero-provenance-design
    content: "Design a reviewed provenance advancement transaction that keeps audited base eded841256, full canonical scope, immutable renamed identities and per-file budgets; bind the old and new genuine upstream commits and every incorporation conflict."
    status: pending
  - id: zero-provenance-implement
    content: "Implement the separately reviewed transition path with independent CI re-derivation and atomic failure, while retaining current rejection of ad hoc ref/scope/allowlist overrides and preserving historical accounting evidence."
    status: pending
  - id: zero-provenance-prove
    content: "Prove that real merged upstream changes are recognized without erasing residual fork edits, resetting budgets, relabeling renamed identities or accepting fork HEAD as upstream; hand the verified transition contract to integration."
    status: pending
isProject: false
---

# Implement reviewed upstream provenance carry-forward

## Execution Notes

Tracking: `modernjs-cdhz.6`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

The current writer explicitly refuses upstreamRef changes. Neither --record-growth nor --rebase-divergence-allowlist supplies this missing provenance operation. Design it openly; do not silently repoint the pinned ref. Keep the audited mainline commit rather than the patch-equivalent non-ancestor tag. Add reverse/failed-transition cases, identity collisions, partial overlap with fork edits and non-ancestor/forged refs. A reviewed classifier correction is permissible only for a proved ownership error with adversarial tests, never as a way to exclude real debt.

## Constraints

Own: scripts/ultramodern-boundary-check provenance validation/writer tests and reviewed design; actual application reserved to packaging/integration.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Boundary-governance owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-ownership-contract](um-zero-20260909-ownership-contract.plan.md)

Verification and exit: Positive and negative fixture repositories establish unchanged budgets/identities and exact upstream contribution subtraction; malformed or incomplete transitions leave all files unchanged. No live transition before the required upstream commits exist.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
