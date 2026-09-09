---
name: um-zero-20260909-update-acceptance
overview: "Prove simple updates through two real candidate transitions. Private neutral, historical, customized OntOS-style, bridge and Tractor-compatible update fixtures; separately reserved ports/artifacts."
todos:
  - id: zero-update-acceptance-forward
    content: "Run supported published-floor\u2192candidate and candidate\u2192next-compatible-candidate updates using real distinct tarballs/cohorts in an isolated registry; exercise the documented entrypoint without manual source/config edits."
    status: pending
  - id: zero-update-acceptance-diff
    content: "Assert same-contract updates change only dependency/lockfile and narrowly derived identity data, legacy transforms occur once, all first-party references match, custom files survive, and repeat invocation is a no-op."
    status: pending
  - id: zero-update-acceptance-failure
    content: "Inject ownership, install, check, interrupted-process and unavailable-registry failures; prove atomic rollback, actionable error classes, safe retry and a functional previously accepted version without bypassing hooks or provenance."
    status: pending
isProject: false
---

# Prove simple updates through two real candidate transitions

## Execution Notes

Tracking: `modernjs-cdhz.24`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

An isolated next-version rehearsal must use distinct real package bytes and a clearly local identity; it is not a claim that the next version was published. Reuse the canonical transaction and registry/manifest helpers. Coordinate live OntOS with its owner and discover it via the project registry before reads; another agent's checkout, manifests or active .4 rehearsal is not a test fixture. Use user-owned deployment/database logic unchanged.

## Constraints

Own: Private neutral, historical, customized OntOS-style, bridge and Tractor-compatible update fixtures; separately reserved ports/artifacts.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Consumer update acceptance owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-integration](um-zero-20260909-integration.plan.md)

Verification and exit: Machine-readable before/after file diffs, zero manual repair on the supported success matrix, complete cohort and runtime tests, and byte-exact rollback/idempotence receipts. Publish no invented time/RSS savings; compare actual observations with user-workflows baseline.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
