---
name: um-zero-20260909-regression-matrix
overview: "Prepare independent boundary, runtime and update regression proofs. New isolated regression fixtures and existing test-harness integration; component source/test files remain with their assigned owners."
todos:
  - id: zero-regression-matrix-matrix
    content: "Build a contract-based matrix covering neutral/customized generation, same-contract and legacy updates, native API identity, routing/i18n/SSR, Node/workerd, build/export types and complete cohort resolution."
    status: pending
  - id: zero-regression-matrix-adversarial
    content: "Add meaningful negative proofs for import alias/barrel/dynamic/type edges, provenance and rename tricks, partial rollback, symlink/ancestor escapes, misleading ownership, mixed delivery units and analyzer process failures."
    status: pending
  - id: zero-regression-matrix-resources
    content: "Give each test run a private workspace, artifact root and process lifecycle; encode real shared-port conflicts instead of pretending ERP and Tractor can share default ports concurrently."
    status: pending
isProject: false
---

# Prepare independent boundary, runtime and update regression proofs

## Execution Notes

Tracking: `modernjs-cdhz.21`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

Prepare fixtures in parallel with implementation once interfaces are stable. Reuse substantive existing tests; avoid implementation-shaped snapshots or tests that merely mirror the patch. Keep Linux runtime/native-analyzer proof and justified Windows/macOS checks; distinguish source, packed and published boundaries. No broad shared tmp cleanup, process killing by guessed PID, or use of another agent's consumer/candidate.

## Constraints

Own: New isolated regression fixtures and existing test-harness integration; component source/test files remain with their assigned owners.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Acceptance fixture owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-ownership-contract](um-zero-20260909-ownership-contract.plan.md), [um-zero-20260909-user-workflows](um-zero-20260909-user-workflows.plan.md)

Verification and exit: Fixture self-checks demonstrate that deliberate representative regressions fail. Final acceptance runs these against built/packed implementations; fixture preparation alone is not runtime or release success.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
