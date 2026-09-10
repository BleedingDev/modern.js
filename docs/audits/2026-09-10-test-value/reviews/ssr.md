This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# UltraModern runtime/SSR test-value audit

Scope: the 61 assigned runtime/render/SSR suites at `4092c606b0704f2e7119c4a16d1d9ef149d28034`, measured against `origin/main...HEAD`. Every assigned suite and every substantive modified-test diff was read. Production implementations and the Node recovery fixture were checked where needed. No repository files were changed and no tests were deleted.

The inventory rates **58 relevant suites**: **14 T0**, **26 T1**, **15 T2**, **3 T3**. Three touched suites contain no net-new scenarios and are excluded. Approximately **372 added expanded cases** are represented, counting literal parameter rows; these are estimates from source, not runner-discovered totals. Counts measure scope, not test value.

- **T0 — earns its keep:** protects delivered behavior, failure boundaries or resource correctness.
- **T1 — useful with excess:** preserve the core, cut duplicate scenarios and implementation details.
- **T2 — consolidate or replace:** worthwhile intent trapped behind weak or redundant oracles.
- **T3 — purge as written:** placebo, literal inventory or proof that survives removing the feature.

The main finding is not that every mock or output-string assertion is bullshit. It is that several tests advertise guarantees they never exercise, while a small group of real stream/render tests does the actual work.

## Confirmed placebo tests

**1. The entire Node manifest-recovery suite survives removing the entire recovery plugin.**

`module-federation/manifest-recovery-node.test.ts:67` and `:145` are the clearest purge candidates. The unchanged child fixture was run with a no-op plugin against the exact installed upstream `@module-federation/runtime@2.9.0`. Both scenarios reproduced every asserted observation:

| Scenario | Output with UltraModern recovery plugin replaced by no-op |
| --- | --- |
| Remote initially unavailable | HTTP 503, degraded HTML, RUNTIME-003 stderr, child alive |
| Remote becomes healthy | HTTP 200, inventory live, same PID, child alive |
| Structurally invalid manifest | HTTP 500, degraded HTML, RUNTIME-013 stderr, child alive |

The child fixture writes the statuses and degraded HTML itself, catches the rejection itself, and relies on upstream MF behavior for the later request. It never runs a Modern request handler or React SSR. Two builds and two child-process scenarios buy no ability to detect removal of the added plugin. Keep the focused retry/timeout policy tests in `manifest-recovery-runtime-plugin.test.ts`; delete this suite as written. A replacement would need to demonstrate a transient failure recovering *within the same request* through the relevant owning integration.

Reproduction: `node /tmp/ultramodern-audit/ssr-mutation-proof.cjs`. Recorded results: `/tmp/ultramodern-audit/ssr-mutation-proof.json`. This is focused replay of the suite's exact scenario observations, not execution of rstest. It used Node v26.8.1, the unchanged snapshot fixture, and the dependency path recorded in the JSON. The no-op module was temporary and removed.

**2. The SSR debugger test hides the very control it claims SSR hides.**

`boundary-debugger/index.test.tsx:6` sets `controlMode: 'hidden'`. Removing the complete production `if (!mounted) return null` guard in memory still produces `<main>app</main>`. With `controlMode: 'visible'`, the same mutant leaks a control into SSR. The existing test is vacuous; replace its input with default/visible mode in the surviving debugger coverage. Both observations are in the same reproducible mutation proof.

**3. The layout test supplies the answer in its geometry mocks.**

`boundary-debugger/client.test.tsx:55` hard-codes `scrollHeight` to 1200 and `:59` returns stored rectangles. The first case later asserts these values have not changed. Those assertions cannot detect layout movement. Delete the first case; retain `browser.test.ts:35`, which measures real Chromium geometry. The late-node resize case at `client.test.tsx:174` does test useful observer behavior and should survive.

**4. The type-contract test is literally `expect([]).toEqual([])`.**

`router/lifecycle.test.tsx:110` computes an `Extract` type, creates an empty array of that type, and asserts the array is empty at `:118`. An empty array type-checks for *any* element type, so this cannot establish absent type keys even with a type checker. The rest repeats the state round-trip earlier in the file. Purge the case. Also purge `:96`, which checks only that six hook objects exist and have a callable property.

## Other hard cuts

| File/case | Verdict | Why it should go or change |
| --- | --- | --- |
| `registrySurface.test.ts:5` | T3 whole file | Reads four literal package.json paths. Never resolves an alias, checks a declaration exists, or type-checks a consumer. |
| `router/provider.test.ts:25` | T3 case | Repeats the six-hook object literal, then asserts exactly six keys. A legitimate new hook breaks the test without breaking behavior. |
| `router/provider.test.ts:37` | T3 case | Export identity, no hook consumer or execution. |
| `router/cliExtension.test.ts:362` | T3 assertion | Requires exactly two include patterns. Pure collection-size policing. |
| `router/cliExtension.test.ts:449` | T1 trim | Rename count, temporary-path diversity and no-lock-file checks freeze the write mechanism. Keep the conserved merged route JSON. |
| `module-federation/index.test.ts:84` | T3 case | Literal telemetry-to-DOM-attribute rename map; no actual fallback UI consumer. |
| `manifest-recovery-runtime-plugin.test.ts:163` | T3 case | Says it tests backoff, but only checks two calls and eventual success. Removing the delay would satisfy the oracle. |
| `core/browser/stream-hydration.test.tsx:23` | T2 replacement | Calls `renderToString` on both sides with the same prefix. Never hydrates a DOM or uses native hydrateRoot. |
| `router/rsc-router.test.tsx:21` | T2 replacement | Accepts any React element with the manually supplied loaderData prop. Does not verify component identity, render output or Flight serialization. |
| `router/templates.test.ts:229` | T3 case inside T2 file | An accept-any-import bundler fabricates a loader returning a hard-coded generated filename. It does not build or execute the generated RSC boundary. |
| `router/templates.test.ts:337` | T2 replacement | Claims mounting behavior but inspects fake lazy descriptors; React is mocked and nothing mounts. |
| `render/tests/build-artifact/ssr-externals.test.ts:10` | T2 infrastructure | Real artifact execution is valuable, but missing dist silently skips the only test. Move into an enforced fresh-build lane; actual CI build ordering was not established in this slice. |

## Duplication families and ownership

**SSR scripts and HTML assembly have too many owners.** `core/server/loadable`, `core/server/string.test.ts`, `ssrHelpers.matrix`, `renderToStream/buildTemplate.after`, `renderToString/buildTemplate`, and `renderToString/entry` repeatedly test ordering, script presence, omission and collector data. The matrix calls the same helpers again; it is not a different integration. `buildTemplate.after:25` even labels a direct test of the *string* SSRDataCollector as stream parity.

Keep one low-level script URL/escaping contract, the executable SSR payload contract in `renderToString/entry`, and one integrated assembly scenario per actual string/stream mode (plus the distinct JSON/CSP variant). Transplant exact-src/query-string and escaped-template edge inputs from the matrix, then delete the matrix file. Fold the separate `core/server/string.test.ts` helper file and `string.test.tsx` smoke into the surviving owners.

**Router registries are over-enumerated.** `provider.test.ts` has 23 scenarios; `provider-realm-isolation` and `internalProvider` recheck ownership selection. Keep one compact precedence/validation table, one independently evaluated same-name realm case, and one wrapper-level correct-factory/no-foreign-factory scenario. Preserve supported mixed-version noninterference, but remove private set sizes, export identity and exact hook counts.

**Head collection is repeated at several layers.** Keep compatibility semantics in `exports/head` and real delivered HTML in the string/stream renderer suites. Remove the duplicate abandoned-Suspense case in `exports/head:26` and the supposed streaming replay at `:280` (it starts two ordinary render transactions). Keep true head transaction rollback and byte conservation in `runtime-extensions/rendererHead`; those exercise a different failure boundary.

**Response cleanup has useful tests buried under copies.** `requestResponse` checks null-body statuses twice; `ssrHelpers.matrix` repeats them a third time. The handler's immediate `Response('ok')` cleanup check at `requestHandler:82` is weaker than its delayed shell/tail case at `:143`. Keep delayed cancellation, locked-body ownership, once-only completion/cancel cleanup, and handler wiring. Delete weaker repetitions.

**Config tests should stop pretending to be runtime acceptance.** `ssr/moduleFederation.test.ts` recreates deepMerge and assumes the first builder plugin, then repeats output flags and missing bundlerChain 17 times. `:215` and `:283` use effectively the same scenario. Fold explicit flags, missing-required-flag rejection, per-entry settings and Worker target into a compact policy table. Actual artifact loading belongs in a real build acceptance test.

## Minimal survivor set

These are the behaviors worth retaining after the cuts. This is an ownership map, not a proposal to add another layer of tests.

| Area | Keep |
| --- | --- |
| Debugger | Real Chromium geometry/ownership; late boundary resize; corrected visible-control SSR case. |
| Hydration | Compiled per-app chunk-global behavior and actual React hydration of server HTML with useId/label targets and recoverable-error assertions. Merge spy-only fallback checks into that owner. |
| Context | Independently bundled context identity; request values; public/internal privacy; RSC serializable request context; extension spread semantics. |
| MF consumption | Incompatible remote never loads; noncritical degraded behavior; default critical rejection; original error survives throwing fallback. |
| MF recovery/cache | Retry cap/timeout/noninterception; cache expiry, out-of-order resolution, wrong-surface/incompatible refresh cannot replace last good state. |
| Distributed rendering | Native factory bypass/cache; asynchronous fragment suspension; props/expose mismatch; delivered fragment markup. Do not call fixture records Worker verification. |
| Router | Actual mounted-router stability; prefetch opt-out and cache identity; stale queued generation is discarded; real filesystem search-contract discovery; owner-scoped regeneration and conserved route-spec writes. |
| HTTP/actions | Correct 404/500 and redirect validity; cancel-before-cleanup; locked body handling; method and payload bounds; redacted action errors. Record action invocation to prove rejected bodies cause no side effects. |
| SSR HTML | Real string and stream head commit; script/CSS order and dedup; nonce/escaping; executable hydration payload; secret-header exclusion; marker omission. |
| Streaming | UTF-8 conservation, split HTML/marker/trailer handling, backpressure, failure propagation and head rollback. Keep these. |
| Failure response | Secret redaction, hostile error access and Retry-After injection/malformed inputs. Compact parameter tables earn their keep. |
| Packaging | Real RSC-on/off emitted module graph and published ESM render entry. Missing artifacts must fail the build lane rather than skip. |

Ambitious whole-file reduction candidates are the three T3 files plus `ssrHelpers.matrix`, both `core/server/string.test.*` files, spy-only `core/browser/hydrate`, fake `stream-hydration`, `exports/loadable`, `router/lifecycle`, and the fragmented telemetry suite. T2 file removal must preserve the specific useful cases identified in the JSON, usually by transferring them into an existing stronger scenario. The 26 T1 suites have additional case-level cuts; T1 does not mean leave everything untouched.

## What must not be mislabeled bullshit

- Counting actual cleanup invocations protects once-only resource release.
- Counting real emitted stylesheet/script/closing-tag occurrences protects delivered HTML semantics.
- Splitting byte streams at every tag boundary tests parser correctness.
- Large byte fixtures exercise retention limits and Unicode truncation bugs.
- Comparing a renderer's returned HTML or executing generated JavaScript tests the product, not the source file.
- Cheap HTTP-status, malformed-header and policy tables need not be deleted merely to reduce a number.

The inherited `document/cli`, `document/index` and `router/routeComponentChannel` suites are excluded from addition accounting. In particular, `routeComponentChannel` contains a weak handwritten pipeline simulation, but this branch only reordered its type import; it is outside the authorized purge scope.

The complete per-suite inventory, exact line anchors, mixed-file keeper notes and confidence levels are in `/tmp/ultramodern-audit/ssr-review.json`. Most conclusions are static semantic review. Only the two explicitly documented mutation probes were executed; no full suite/build/install was run.
