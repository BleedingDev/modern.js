---
name: um-zero-20260909-integration
overview: "Qualify one complete source and immutable package candidate. Final shared changesets, quality gates, clean source commit, full cohort build and immutable staging; one owner controls source and artifact identity."
todos:
  - id: zero-integration-quality
    content: "Run affected component suites, generator and publication tooling tests, package/type/export checks, changesets/lint, canonical zero gates and required OS/native-runtime proofs on the complete final ref."
    status: pending
  - id: zero-integration-freeze
    content: "Commit and push the qualified source to bleedingdev, freeze the full package cohort and sidecars from clean built bytes, and record manifest/tarball/source/toolchain digests without reusing old accepted candidates."
    status: pending
  - id: zero-integration-handoff
    content: "Reserve target-private acceptance workspaces and hand identical immutable bytes to source and update acceptance owners; any source/package change creates a new candidate and invalidates dependent evidence."
    status: pending
isProject: false
---

# Qualify one complete source and immutable package candidate

## Execution Notes

Tracking: `modernjs-cdhz.22`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

PR49 candidate7871954269 is historical source evidence, not approval of a later candidate. Its final tracking-only commit114047c57d contains no new framework source. Never silently merge another agent's work or take its release version/registry. Read-only upstream/fork discovery is allowed; release only after source integration and zero gates are green.

## Constraints

Own: Final shared changesets, quality gates, clean source commit, full cohort build and immutable staging; one owner controls source and artifact identity.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Integration and release owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-zero-gate](um-zero-20260909-zero-gate.plan.md), [um-zero-20260909-native-usage](um-zero-20260909-native-usage.plan.md), [um-zero-20260909-legacy-migrations](um-zero-20260909-legacy-migrations.plan.md), [um-zero-20260909-regression-matrix](um-zero-20260909-regression-matrix.plan.md)

Verification and exit: All required source checks pass with no waived/unchecked failures; frozen artifact identity and clean pushed source are independently recorded. No merge/release while canonical failures remain.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
