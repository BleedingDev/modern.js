---
name: um-zero-20260909-legacy-migrations
overview: "Provide complete, bounded upgrades from supported older workspaces. Existing migration ownership recognizers and versioned transformations; no second updater or application edits."
todos:
  - id: zero-legacy-migrations-floor
    content: "Define the supported migration floor from actual published artifact/consumer evidence and inventory every schema/API transition still needed, including customized OntOS-style workspaces and historic generated validators."
    status: pending
  - id: zero-legacy-migrations-transform
    content: "Implement each necessary one-time transformation with exact ownership/public-contract checks and direct native API imports; preserve authored files and reject conflicting custom baselines before promotion."
    status: pending
  - id: zero-legacy-migrations-regressions
    content: "Verify old\u2192current\u2192next, interrupted retry, rollback and idempotence for custom ports, shells, TS/MF/Modern configs, scripts, patches, reference repositories, symlinks and supported nested external bridges."
    status: pending
isProject: false
---

# Provide complete, bounded upgrades from supported older workspaces

## Execution Notes

Tracking: `modernjs-cdhz.18`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

The floor is an explicit version/contract boundary, not an expiry date or an assumption that no external users exist. Reuse PR49 history recognizers and scope guards. Native API replacement is preferred to compatibility wrappers; an unsupported customized case must receive an actionable preflight conflict, not a half-updated workspace. No global-hook bypass, synthetic links/navigation or per-app config suppression.

## Constraints

Own: Existing migration ownership recognizers and versioned transformations; no second updater or application edits.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Legacy migration owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-update-transaction](um-zero-20260909-update-transaction.plan.md)

Verification and exit: Historical packed fixtures plus a real customized consumer, with exact diff/rollback assertions. Baseline retirement involving external bridge consumers must fail atomically unless their coordinated migration is genuinely in scope.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
