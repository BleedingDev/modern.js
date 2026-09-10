This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# Server tests: brutal audit

Snapshot: `4092c606b0`, `/tmp/ultramodern-test-audit-20260910`, compared with `origin/main...HEAD`. All 83 assigned suites were reviewed at their assertion surfaces; modified suites were compared against baseline hunks, with full scenario/helper/production reads where needed. No tests or production files were changed. No dependencies were installed and no full suite was executed; the pinned checkout has no rstest/tsx dependency binaries. The stale behavior findings below are established by source comparison, not reported as an executed test failure.

The per-suite JSON is exhaustive. Distribution: **19 T0, 29 T1, 25 T2, 7 T3, 3 excluded**. `cases_added_estimate` totals **554** expanded test cases, including substantially rewritten fork scenarios and one strengthened existing reload case; these are approximate audit workload counts, not a mechanically verified net-added test count. The inherited watcher reactivation has zero new case declarations and is rated only for its fork harness change. A mixed suite's overall tier does not authorize deleting its useful minority.

## Highest-confidence garbage

- **Obsolete deployment autopilot fiction.** `runtime-extensions/tests/telemetryLifecycle.test.ts:102` waits for `canary.state === 'promoted'` at241, then `rolled_back` at299, and requires `telemetry.canary.rollback` at333/337. Current `src/telemetry/runtimeEndpoints.ts:120` exposes **health**, and `TelemetryHealthMonitor` has **pending / healthy / unhealthy** states. Purge that entire scenario. Do not restore deployment behavior to appease it. Keep the shutdown flush at347.
- **Stale response assertions scattered into otherwise useful tests.** `prod-server/tests/applyPlugins.test.ts:82` requires `status.canary.enabled`; `runtime-extensions/tests/telemetryAutopilot.test.ts:325`, `580`, and `1128` repeat it. The real source emits `health`. The unauthenticated status case checks that obsolete `canary` is absent at1046 but never asserts that current `health` is absent. Fix the survivor's observable contract; delete the stale assertions.
- **Testing test data.** `bff-core/tests/adapterKit.test.ts:198` checks unique fixture names and an exact denial-reason multiset; at238 it compares the fixture helper to a transcription of its own configuration and six handler names. At276 it feeds an assertion helper only matching hand-built responses, so even a no-op assertion helper passes. Purge this parity-table block. `crossProjectPolicy.matrix.test.ts:455/468` similarly checks two local lists agree and labels are unique; neither proves runtime coverage.
- **Manifest transcription.** `bff-effect/tests/package-surface.test.ts:106` locks branding URLs, keywords, files, Node engine, scripts, publish settings and other package.json trivia. At141 it hardcodes the Effect release candidate version in dev and peer dependencies. Routine upgrades and harmless metadata edits become test failures. Purge those two cases. Preserve actual CJS/ESM loading, cross-format factory identity and strict consumer typechecks.
- **Homemade dependency scanner.** `bff-effect/tests/edge-entry-safety.test.ts:47` uses a regex parser and its own resolver, includes erased `import type` dependencies, follows only relative imports, then bans words such as adapter/generator in paths. The product is an edge runtime; the test's oracle is a handwritten source crawler. Purge it and use one real edge consumer/bundle/load acceptance test.
- **Exact copy policing.** `bff-effect/tests/effect-module-diagnostic.test.ts:17` starts a real Effect module only to match a long advice sentence exactly. Purge the file.
- **Fake MF cache integration.** `bff-effect/tests/data-platform-contract.test.ts:383` creates two local Maps, explicitly deletes their entries inside the test, then asserts its own deletion. It only repeats the `shouldApplyInvalidation` predicate already tested at324. Purge this scenario. The “simulated distributed tracing” at466 is only a child-context codec example; the actual emitted-span tracing test is much stronger.
- **Invented incidental limits.** `effect-batch-operation-boundary.test.ts:132` requires serialized diagnostics shorter than512 characters although the actual requirement is absence of secrets. `telemetryRegistryQueueMatrix.test.ts:105` pins exactly five envelopes, including incidental self-metrics. `telemetryHealthMonitor.test.ts:87` searches JSON for forbidden promote/rollback words. Delete these constraints.
- **HTML implementation locks.** `core/tests/utils/error.test.ts:40/43` fixes exactly one body child and two page children; at53 it requires flex/column/centering and at60 exact viewport height. These are brittle layout implementation checks. Keep readable status/title and the genuinely useful safe-error / Retry-After security tests.
- **Generated-consumer mocks erase module identity.** `bff-core/tests/client/generateClient.test.ts:25` resolves every imported specifier to the same stub exports. A wrong custom requestCreator/fetcher module path still passes. Its emitted-code execution is useful, but the custom-module scenarios need distinct modules or actual consumer resolution.
- **Scripted ManagedRuntime theatre.** `bff-effect/tests/effect-disposal-client.test.ts:26` supplies scope, client and disposal answers by call number regardless of which Effect is passed. Assertions then require exactly three calls and identical promise objects. Replace with a real acquireRelease finalizer case; retain one initialization-failure injection. `effect-module-disposal.test.ts` already demonstrates a much better real finalizer harness.

## Small duplicate files to drop

These have stronger existing survivor assertions; the JSON identifies the exact retention boundary.

| Candidate | Existing survivor |
|---|---|
| `create-request/tests/acceptHeader.test.ts` | `requestFactory.outbound-contract.test.ts:118` |
| `create-request/tests/browser-get-body.test.ts` | Same outbound scenario, GET body stripping |
| `create-request/tests/identityBinding.test.ts` | Outbound matrix at199 plus public Node header control |
| `bff-effect/tests/effect-batch-log-redaction.test.ts` | `effect-batch-operation-boundary.test.ts:131-134` |
| Only fork-added `bff-core/tests/operators/http.test.ts:204` Upload case | `operators/http.matrix.test.ts:119` valid/invalid Upload rows |

Combined with the edge crawler and exact diagnostic file, these are seven T3 audit units. One is a hunk in an inherited suite, not permission to delete the upstream file.

## Consolidation families

1. **Cross-project policy:** handwritten policy suite + policy matrix + resolver config tests + adapter kit + adapter integration matrices. Keep one table per distinct trust decision and a minimal adapter wiring smoke. The observed request route/method, identity verification, malformed encoding and ambiguity regressions in `crossProjectPolicy.test.ts` must survive. Basic missing-envelope/malformed-header/known-contract cases do not need repetition at every wrapper.
2. **Request construction:** browser + node additions + policyCore + outbound contract + three one-off files. Make outbound-contract the shared owner; retain browser `process` absence/domain semantics and Node request-context header propagation. Keep one public entry control per platform. Remove the copied helper and policy matrices.
3. **Resilience:** browser and node repeat the same fake-timer retry/backoff/exhaustion/timeout scaffolding. `transport-retry.test.ts` should own the behavior, with one entry wiring check and uploader-specific policy check.
4. **Edge runtime:** parent CLI reviewer confirmed eleven runtime cases in `plugin-bff/tests/effect-edge-runtime.test.ts` duplicate the owner `bff-effect/tests/effect-edge-runtime.test.ts`. Keep the owner, including its additional forged-brand rejection, and purge the CLI copy. Fold tiny OpenAPI/context/export-shape suites into the owner instead of adding more namespace checks.
5. **MF cache policy:** `mfCache.test.ts` tests classifiers, header maps and stub middleware, while `prod-server/applyPlugins.test.ts` and `backendFederationAssets.test.ts` test real assembly. Preserve the real assembly and two negatives (error/non-MF responses); drop the redundant layers. CSS registration's handcrafted middleware order is superseded by actual prod assembly.
6. **Batch protocol:** retain malformed-wire, safe replay, cancellation and trust isolation. Merge malformed response rows from codec-boundaries into protocol/fallback. Drop hand-edited bucket.timer internals from registry-lifecycle; exercise cleanup via queued requests. Collapse exotic RequestInit descriptor cases into one table without deleting their distinct browser compatibility behavior.
7. **Telemetry registry:** registry.test and queue-matrix repeat window drop pressure, depth/utilization and SLO alerts. Keep one transition matrix, recursive secret redaction, exporter isolation and shutdown flush. The case named redaction+backpressure at `telemetry.test.ts:34` only proves the sensitive event was dropped; it never proves redaction. Keep the separate real recursive-redaction case.
8. **Compiler configuration:** `tsgo.test.ts:203/229/296` copies flags into expected objects and rereads the same JSON to assert them again. Replace with a compact actual compile-and-run consumer for noEmit/composite/native-extension settings. Unique generated filenames alone are not proof that concurrent compiles both complete correctly.

## Minimum useful server coverage to preserve

The server subset contains serious behavior; deleting it indiscriminately would remove protection from duplicate writes, credential leakage and remote-code execution.

- One cross-project trust matrix plus adapter/public-entry wiring, including observed route/method binding and verified identity.
- Batch client/server round trips for bytes/FormData/null bodies, exact wire-byte caps, authenticated partitions, malformed input, per-item failures and **never replaying ambiguous writes**.
- Queue cancellation before enqueue, while queued, during shared flight, after timeout, and during remaining-budget replay; requests queued during flush must survive.
- Actual Effect HTTP input/output validation, interleaved request context, forged factory-brand rejection and real resource finalizers.
- Strict consumer typechecking and executable packed module resolution; one emitted-span tracing integration and one actual telemetry collector integration.
- Real production assembly for static/MF asset serving, locale bypass, caching, traversal/symlink containment and sanitized503/Retry-After errors.
- Remote entry integrity/identity verification **before evaluation**, stream caps, timeout/caller cancellation, redirect redaction and evaluator dependency restrictions.
- Atomic snapshot writes, app-local custom store resolution, stale/out-of-order observer transitions, endpoint authorization and rate-limit identity rotation.
- Real compile-and-load module rewriting across ESM/CJS/UTF-8/declarations/native extensions, alias rewriting even when diagnostics fail, and cleanup on failed child spawn.

## Important scope corrections

`core/tests/plugins/render.test.ts`, `server/tests/devRuntimeReload.test.ts`, and `server/tests/mock.test.ts` have only import-order changes: excluded completely. `utils/tests/ts.test.ts:50` has the ugly `files.length === 2` assertion, but it is **inherited unchanged from origin/main** and was only moved into a try/finally block. Do not falsely count that as an UltraModern addition.

Source comparisons in `importRewriter.test.ts` are not the same problem as implementation-source policing: transformed source is its product output, and major cases actually execute it. Byte-length assertions in batch limits and remote-entry integrity likewise validate real resource/security contracts. Their use of a number is not a reason to purge them.

Additional infrastructure concern: many telemetry plugin tests initialize long-lived registries/observers and only remove temporary directories in finally, without triggering their registered close hook. `src/telemetry/lifecycle.ts:35/93` retains their closers in a module-level Set until Node close or process beforeExit; unref timers still retain work during the test process. Consolidation should use one owned server harness with a close trigger and awaited flush/teardown. Do not “fix” noisy teardown by disabling the useful trust-boundary assertions.
