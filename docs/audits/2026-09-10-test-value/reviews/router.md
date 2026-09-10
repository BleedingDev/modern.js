This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# UltraModern additions: i18n and TanStack test-value audit

Scope: 42 added suites at commit `4092c606b0` in `/tmp/ultramodern-test-audit-20260910`, against the parent audit inventory derived from `origin/main...HEAD`. Approximately 300 expanded cases, including loop/each expansion. All suite bodies and relevant fixture/helper implementations were read. These are review verdicts, not test execution results. No repository implementation or tests were modified; the isolated checkout has no `node_modules`, and no install/build was attempted.

**Verdict: this area has real regression coverage worth defending, mixed with a large layer of configuration photocopies and toy-router theater.** Delete the obvious bookkeeping first. Then consolidate the large CLI/type suites around actual generated files consumed by real runtime declarations. Preserve async race, hydration, route identity, error isolation and SSR effects.

Tier meanings: T0 = strong behavior, keep; T1 = useful, trim; T2 = weak proxy or substantial consolidation/replacement needed; T3 = purge candidate. Mixed suite grades describe the suite as a whole; the JSON supplies exact case-level exceptions.

| Tier | Suites | Expanded cases in those suites |
|---|---:|---:|
| T0 | 7 | 16 |
| T1 | 20 | 187 |
| T2 | 9 | 89 |
| T3 | 6 | 8 |

## First deletion batch: six complete suites

These six suites represent eight expanded cases. Deletion is recommended, not performed. Packaging should be covered by one real consumer import/typecheck, and dependencies should own their detailed runtime regressions.

- `packages/runtime/plugin-i18n/tests/peerCohort.test.ts` — Copies peer version strings and optional flags out of package.json into a test. It proves no installation, type compatibility, or runtime interoperability; legitimate dependency updates pay a bookkeeping tax.
- `packages/runtime/plugin-tanstack/tests/router/fastDefaults.test.ts` — Two tests copy a boolean config default and object override. Neither proves structural sharing works, avoids recursion, or reaches the actual router.
- `packages/runtime/plugin-tanstack/tests/router/hydrationBoundary.test.tsx` — Reads React element type/props and reference equality. It freezes a JSX wrapper implementation and never hydrates, suspends, or checks mismatch recovery.
- `packages/runtime/plugin-tanstack/tests/router/packageSurface.test.ts` — Asserts a manifest object equals a second hard-coded copy. A broken or missing dist file still passes. Legitimate package layout improvements fail.
- `packages/runtime/plugin-tanstack/tests/router/preloadRedirect.test.ts` — Imports only upstream TanStack and constructs its own router with literal structural-sharing option. No Modern/UltraModern implementation is exercised. Current patch ledger describes only a TanStack declaration patch, so this is third-party runtime regression ownership.
- `packages/runtime/plugin-tanstack/tests/router/register.test.ts` — One typeof global registration check is completely subsumed by loading actual provider graphs in realm-isolation/routerCompatibility and server plugin setup.

## Highest-return surgery

1. **`plugin-tanstack/tests/router/cli.test.ts` (1,098 lines, 18 tests): cut hard.** The bodies at lines 246 and 292 are byte-identical. Lines 906, 925, 1003 and 1065 copy defaults or recheck generic `mergeConfig` with input values the plugin never touches. Line 1095 only checks an export is a function. The “regenerates” case at 823 never calls `regenerate` or observes changed output. The “merges route specs” case uses the test-owned merge implementation at 176. Retain entry ownership exclusions at 508 and a compact actual generation/consumer compilation path.

2. **`tanstackTypes.test.ts` (1,248 lines, 16 tests): the fake runtime is not a router.** `writeRuntimeTestPackage` at 57 creates its own package, and its `createRouter` implementation at 122 simply returns its input. Five execution scenarios run against this toy graph. These checks can catch emitted syntax/import/wiring mistakes, so they are not literally empty, but the labels oversell runtime confidence. The installed TanStack declaration case at 743 is the stronger survivor. Retain the resolver-race case at 627, one comprehensive generated router run using the real runtime, and one combined positive/negative canonical-param fixture. Delete standalone alphabetical ordering at 1211. The seven canonical typecheck scenarios can share one compiler process without losing constraints.

3. **`routeTree.test.ts` (932 lines, 22 tests): keep routes working, stop snapshotting their guts.** Delete public export/manifest checks at 152/156, the weak lazy-preload case at 546 (actual lazy SSR at 580 supersedes it), exact completed-Suspense-comment count at 362, and shape-only metadata copies. Keep rendered child text at 361. Replace `validateSearch`/`loaderDeps` identity at 417 and manual `shouldReload` invocation at 685 with a real search/navigation result if that coverage is retained.

4. **Mocked prop contracts are scattered across i18n Link, routerAdapter, prefetchLinkPreload and routeHooks.** `link.test.tsx:50` defines what it believes TanStack Link does; `prefetchLinkPreload.test.tsx:17` replaces the native hook entirely; `routeHooks.test.ts:9` makes five hooks into option recorders. These do not verify native navigation, viewport preloading, or structural-sharing safety. Retain a tiny adapter mapping table for genuinely transformed options; use one actual-router interaction for the behavioral guarantee.

5. **The decoder matrix is now upstream regression ownership.** `rscDecoderSecurity.test.ts` expands six cases over node/edge and development/production into 24 child processes. The fixture calls public `react-server-dom-rspack` APIs; it does not touch UltraModern code. `patches/README.md:44` states 0.1.0 contains the official fixes previously backported, and company RSC remains disabled. Move any desired regression sentinels into a dependency upgrade lane and shrink the multiplier. Do not count these as evidence the fork RSC router works. The cyclic-work/rejection and malformed Blob checks are real defenses; their value is separate from ownership and frequency.

6. **Delete duplicate helper rows.** `i18nUtils.test.ts:58` computes its expected value with the same production directory resolver. `plugin-i18n/localisedUrls.test.ts:192` is a strict subset of the alias test at 134. `rsc.test.tsx:72` repeats the more complete graph round-trip, and redirect cases 304/317 repeat the payload matrix. `routerAdapter.test.tsx:821` checks only function/existence. `localisedUrlRewriteMatrix.fork.test.ts` is mostly a second home for existing URL rewrite examples. Fold repeated-query/splat edge cases into the public Link survivor and remove the extra suite.

## Do not purge these just because they contain counts or strings

- `languageSyncController.test.ts:178`: retry count bounds permanent failure and prevents infinite work. That count is the requirement.
- `ssrPreload.test.ts:4`: one preload per component identity is a deduplication guarantee.
- `i18n-extensions/localisedUrls.test.ts:194`: distinct route IDs prevent route collisions; uniqueness is necessary.
- `rsc.test.tsx:408` and payload matrix `:72`: independent user/method results prove cache separation; fetch counts support that behavior.
- `slotUsageSanitizer.test.ts:4` and `rsc.test.tsx:215/274`: output string checks prove secret redaction. They inspect produced data, not repository source formatting.
- `localisedIdentity.test.tsx:26`: actual URLs, loader output and rendered strings are exactly the user-facing contract.

## Minimal surviving coverage by responsibility

| Responsibility | Minimum useful survivors |
|---|---|
| Language coordination | Five controller fault modes; abandoned React render and online recovery; one mounted provider stale-completion test plus native link/history translation |
| Federated translation | SSR host-store isolation/failing-clone guard and one hydrate/click language-switch scenario |
| Localized routes/links | One collision/param/encoding table; `localisedIdentity` real SSR/navigation; one public Link interaction covering suffixes, active attributes and fallback anchor output |
| Plugin generation/types | One real headless generated-artifact/consumer check; ownership exclusions; resolver race; one combined negative canonical typing fixture |
| Router/SSR adapter | Real dynamic/pathless/splat routing, lazy/nested-default SSR, redirect/404/Response handling, stale request URL and revalidation effect |
| Mutation | One deferred submit state transition, error branch, GET branch, overlapping operation branch, submitter fallback |
| RSC fork helpers, while retained | One value-graph matrix, stream replay, production redaction table, user/method cache isolation, actual route/payload identity, original failure/redirect propagation |
| Packaging/dependencies | One external consumer import/typecheck; optional-dependency rejection bundle and cross-copy context render; dependency regressions outside the default fork runtime lane |

Do not interpret combining cases as increasing assurance by reducing a number. The reduction is useful when it removes repeated setup/compiler/build passes and keeps a distinct failure mode observable. T2 recommendations identify needed replacement where deletion alone would leave a real gap.

## All 42 suites

| Suite | Tier | Cases | Recommendation |
|---|---|---:|---|
| `i18n-extensions/tests/clientRedirectIntegration.test.tsx` | T1 | 1 | KEEP; merge into the provider/router integration suite |
| `i18n-extensions/tests/languageSyncController.test.ts` | T0 | 5 | KEEP |
| `i18n-extensions/tests/localisedUrls.test.ts` | T1 | 33 | TRIM duplicates; keep the route-matching and collision matrix |
| `i18n-extensions/tests/reactLanguageSync.test.tsx` | T0 | 2 | KEEP |
| `plugin-i18n/tests/backendDefaults.test.ts` | T1 | 4 | CONSOLIDATE to a table and clean temporary directories |
| `plugin-i18n/tests/federatedI18nBoundary.client.test.tsx` | T0 | 1 | KEEP |
| `plugin-i18n/tests/federatedI18nBoundary.test.tsx` | T0 | 2 | KEEP; trim redundant contains assertions |
| `plugin-i18n/tests/i18nUtils.test.ts` | T2 | 4 | PURGE the self-oracle/default check; replace smoke checks with one real backend load |
| `plugin-i18n/tests/link.test.tsx` | T1 | 28 | TRIM utility repetition; replace native-routing claims with a compact real-router navigation test |
| `plugin-i18n/tests/linkTypes.test.ts` | T1 | 2 | KEEP real positive/negative type contracts; consolidate build/setup with the type lane |
| `plugin-i18n/tests/localisedUrlRewriteMatrix.fork.test.ts` | T2 | 11 | DELETE the separate duplicate matrix after folding unique rows into the survivor |
| `plugin-i18n/tests/localisedUrls.test.ts` | T1 | 9 | KEEP middleware behavior; remove duplicate route-expansion cases |
| `plugin-i18n/tests/peerCohort.test.ts` | T3 | 1 | PURGE |
| `plugin-i18n/tests/reactI18nextRuntimeBoundary.test.ts` | T1 | 6 | KEEP missing-dependency bundle and cross-copy render; purge entry-shape pinning |
| `plugin-i18n/tests/redirectPolicy.test.ts` | T1 | 3 | CONSOLIDATE into middleware-driven allow/deny rows |
| `plugin-i18n/tests/routerAdapter.test.tsx` | T1 | 22 | AGGRESSIVELY TRIM; keep async provider lifecycle and native history navigation |
| `plugin-tanstack/tests/realm-isolation.test.ts` | T1 | 1 | KEEP one realm interoperability scenario |
| `plugin-tanstack/tests/router/cli.test.ts` | T2 | 18 | CUT heavily; consolidate into real generation/typecheck and ownership tests |
| `plugin-tanstack/tests/router/clientHydration.test.tsx` | T1 | 3 | KEEP focused Suspense/error behavior; name the mocked boundary accurately |
| `plugin-tanstack/tests/router/dataMutation.test.tsx` | T1 | 9 | KEEP state transitions/concurrency; merge repeated submit setup and replace routing proxies |
| `plugin-tanstack/tests/router/fastDefaults.test.ts` | T3 | 2 | PURGE standalone suite; assert behavior in one real router test |
| `plugin-tanstack/tests/router/flightSerialization.roundtrip.test.tsx` | T1 | 1 | KEEP as the single value-graph matrix; fold duplicates from rsc.test.tsx |
| `plugin-tanstack/tests/router/generateRouteArtifacts.test.ts` | T2 | 2 | REPLACE happy-path mock choreography with one actual generated-artifact check; keep missing-config guard |
| `plugin-tanstack/tests/router/hooks.test.ts` | T2 | 3 | CONSOLIDATE into one hook execution test; purge empty-state smoke |
| `plugin-tanstack/tests/router/hydrationBoundary.test.tsx` | T3 | 2 | PURGE; preserve actual suspension/hydration behavior elsewhere |
| `plugin-tanstack/tests/router/loaderBridge.test.ts` | T1 | 14 | KEEP redirect/error conversion; delete lower-level duplication |
| `plugin-tanstack/tests/router/localisedIdentity.test.tsx` | T0 | 1 | KEEP; use as the template for survivors |
| `plugin-tanstack/tests/router/packageSurface.test.ts` | T3 | 1 | PURGE; one installed/packed import smoke should own packaging |
| `plugin-tanstack/tests/router/prefetchLink.test.tsx` | T1 | 6 | KEEP native-link behavior; combine active/inactive into one navigation scenario |
| `plugin-tanstack/tests/router/prefetchLinkPreload.test.tsx` | T2 | 8 | SHRINK to boundary mapping rows or replace with real preload invocation |
| `plugin-tanstack/tests/router/preloadRedirect.test.ts` | T3 | 1 | REMOVE from fork runtime suite; keep only if explicitly owning dependency acceptance |
| `plugin-tanstack/tests/router/register.test.ts` | T3 | 1 | PURGE |
| `plugin-tanstack/tests/router/routeHooks.test.ts` | T2 | 3 | REPLACE with one real-router hook/structural-sharing regression |
| `plugin-tanstack/tests/router/routeTree.test.ts` | T1 | 22 | TRIM metadata/export/check-count noise; keep real loader, matching, SSR and redirect effects |
| `plugin-tanstack/tests/router/routerCompatibility.test.ts` | T1 | 3 | KEEP compatibility fixture; merge duplicated realm identities |
| `plugin-tanstack/tests/router/rsc.test.tsx` | T1 | 14 | KEEP redaction/cache isolation/actual stream results; consolidate duplicate helper tests |
| `plugin-tanstack/tests/router/rscDecoderSecurity.test.ts` | T2 | 24 | MOVE to optional dependency-upgrade acceptance and cut the 4x multiplier |
| `plugin-tanstack/tests/router/rscPayloadRouterMatrix.test.ts` | T1 | 5 | MERGE with rsc.test.tsx; delete impossible-state bookkeeping |
| `plugin-tanstack/tests/router/serverPlugin.test.ts` | T0 | 4 | KEEP; combine success/status and active-link scenario setup |
| `plugin-tanstack/tests/router/slotUsageSanitizer.test.ts` | T0 | 1 | KEEP |
| `plugin-tanstack/tests/router/ssrPreload.test.ts` | T1 | 1 | KEEP as one deduplication row in SSR tests |
| `plugin-tanstack/tests/router/tanstackTypes.test.ts` | T2 | 16 | CUT duplicate fake-runtime compilations; retain one real declaration compile, resolver race and combined negative type contract |

Exact line-level evidence and useful minorities are in `router-review.json`. Expanded case counts are estimates from static `test`/`it` declarations and loops, not runner discovery. No tests were run in this isolated checkout.
