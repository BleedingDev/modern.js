---
name: um-zero-20260909-native-usage
overview: "Make native workflows discoverable and keep applications small. Existing create/tooling help and dispatch, root user-facing skills, fork-owned public documentation and example input fixtures."
todos:
  - id: zero-native-usage-commands
    content: "Document and align create, add-vertical, add-shell, update, format, check, build and delivery-unit commands with actual dispatch/catalog metadata; remove redundant public steps without hiding required validation."
    status: pending
  - id: zero-native-usage-examples
    content: "Demonstrate native Effect API composition, TanStack Link/search/navigation, localized routes and Node/workerd deployment in minimal generated fixtures, preserving neutral defaults and consumer-owned business choices."
    status: pending
  - id: zero-native-usage-instructions
    content: "Replace obsolete API guidance directly, explain genuine breaking migrations and conflict recovery, and synchronize generated skill mirrors through pnpm sync:skills rather than hand editing them."
    status: pending
isProject: false
---

# Make native workflows discoverable and keep applications small

## Execution Notes

Tracking: `modernjs-cdhz.19`. Parent planning program: `modernjs-cdhz`. **Planning only: every implementation todo remains pending.** No subagents are launched by this plan. Read [the program contract](um-zero-20260909-overview.md) and [initial ownership coverage](notes/um-zero-20260909/ownership-coverage.md).

No bespoke framework DSL, app navigation wrapper, synthetic anchor handler, copied checker, or architecture lecture in the normal user flow. Shells stay thin and headless verticals remain valid. The native workflow must be executable from the documented commands without hidden preparation from an agent session. Documentation deployment belongs to the final release; this lane owns content and executable examples.

## Constraints

Own: Existing create/tooling help and dispatch, root user-facing skills, fork-owned public documentation and example input fixtures.

Keep AGENTS.md Rules 1–5, CONTEXT.md and ADR-0019. Additive fork behavior belongs in genuine fork-owned packages; audited identities retain their full-PR 20-line cap and required same-PR ledger. No allowance reset, scope narrowing, hidden import indirection, generated-output edit, app shim or hook bypass. Current planning permission does not authorize implementation, upstream submission, merge or release.

## Operator Guidance

Owner: **Developer experience owner**. You are not alone in the codebase: preserve other owners' work and do not edit outside your reservation. Shared manifest, export, lockfile and ledger changes go to integration owners. At execution, update these todo statuses and the br issue from actual evidence; never mark future work completed merely because its plan exists.

Dependencies: [um-zero-20260909-generated-surface](um-zero-20260909-generated-surface.plan.md)

Verification and exit: Run documented journeys as fixtures, verify command/help parity and references, and count required user actions. Every supported success case must finish without manual source/config repair. Preserve original Tractor visuals.

Launch successors when their actual prerequisites finish. Do not impose a global wave or two-agent cap. Retain exact plan selection/dependencies and graph ID when later running plan-graph/subagent-graph/helm. Upstream wait states and shared ports are real constraints; elapsed time is not approval.
