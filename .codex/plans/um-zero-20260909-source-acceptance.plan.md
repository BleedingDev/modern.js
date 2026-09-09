---
name: um-zero-20260909-source-acceptance
overview: "Verify ERP and Tractor on exact source artifacts. Private ERP-10 and reviewed Tractor workspaces and their Node/workerd evidence."
todos:
  - id: zero-source-acceptance-erp
    content: "Run the complete supported ERP-10 source acceptance driver with matching source/version/manifest identity, including Node/workerd browser, API and operational-independence checks."
    status: pending
  - id: zero-source-acceptance-tractor
    content: "Use the required canonical Tractor repository if available and exclusively reserved, otherwise record absence and use the reviewed private baseline; run supported migration, explicit formatting/checks, Node/workerd SSR and visible shopping acceptance."
    status: pending
  - id: zero-source-acceptance-bind
    content: "Verify complete receipts and required check identities against the same manifest, preserve visible Tractor UI and capture source-versus-published status, failures and resource cleanup honestly."
    status: pending
isProject: false
---

# Verify ERP and Tractor on exact source artifacts

## Execution Notes

Tracking: `modernjs-cdhz.23`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

Existing full drivers cover both platforms; do not launch duplicate ERP suites under separate Node/Cloudflare labels. On one host, ERP and Tractor use shared default ports and run serially; parallelism requires truly isolated supported environments, not app config remapping. Reserve external TMPDIR roots so generated repos cannot inherit framework Git state. No consumer workaround, arbitrary hash approval or generated-output patch.

## Constraints

Own: Private ERP-10 and reviewed Tractor workspaces and their Node/workerd evidence.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Source acceptance owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-integration](um-zero-20260909-integration.plan.md)

Verification and exit: Fresh complete source receipt plus operational independence, Tractor exact report, real visible UI/search/API/SSR results on both platforms, and no leaked owned server/registry processes.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
