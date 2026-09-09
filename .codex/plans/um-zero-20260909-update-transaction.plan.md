---
name: um-zero-20260909-update-transaction
overview: "Make same-contract updates primarily dependency changes. Existing migrate-strict-effect entry/orchestrator, MigrationIo transaction, cohort selection and structured change/preserve/conflict reporting."
todos:
  - id: zero-update-transaction-classify
    content: "Extend the existing supported update path to distinguish same-contract dependency/cohort updates from actual public API or configuration-schema migrations, based on versioned contract evidence rather than source-format guesses."
    status: pending
  - id: zero-update-transaction-minimal-update
    content: "Implement the same-contract path so it changes dependency references, lockfile and narrowly derived release identity data while leaving consumer TS/JS, topology, deployment config, custom scripts and patches byte-for-byte unchanged."
    status: pending
  - id: zero-update-transaction-atomic
    content: "Expose the existing dry-run/change/preserve/conflict result and make validation, failed installation, interrupted execution and retry preserve or restore the entire transaction; second application is a no-op."
    status: pending
isProject: false
---

# Make same-contract updates primarily dependency changes

## Execution Notes

Tracking: `modernjs-cdhz.17`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

One documented public update entry reuses current CLI and MigrationIo; a new doctor/governance CLI or permanent compatibility alias is not the objective. Preserve compatible newer package-manager settings, every first-party dependency, custom patches and consumer script segments. Never interpret an arbitrary consumer tree or reference repository as a migration target. Keep analyzer/runtime/ownership/network errors distinct and actionable.

## Constraints

Own: Existing migrate-strict-effect entry/orchestrator, MigrationIo transaction, cohort selection and structured change/preserve/conflict reporting.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Update transaction owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-generated-surface](um-zero-20260909-generated-surface.plan.md)

Verification and exit: Real tarball-based N→N+1 same-contract update; exact allowlisted file diff with zero generated TS/JS or deployment-config edits; dry-run no mutation; second run no-op; injected install/check failure and interruption restore bytes, symlinks, index and Git metadata.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
