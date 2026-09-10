This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# Added integration tests: ruthless audit

Audited snapshot: `4092c606b0` in `/tmp/ultramodern-test-audit-20260910`. Reviewed all 35 assigned suites, their relevant fixtures, framework test discovery, build cache and certification runner. No repository files changed, no suites deleted, no expensive builds/installations run. This is an assertion/ownership audit, not a claim that every suite currently passes.

Scope correction matters: `bff-cross-project` is the renamed upstream `bff-corss-project`. Its index contributes **7 new cases**, plus policy assertions inside 2 inherited cases. The original packed-tarball portability case is inherited; only its new NodeNext case and changed assertions are rated. `routes-inspect.test.ts` is an extraction of upstream's existing report case and is excluded.

| Tier | Assigned files | Added cases, estimate | Verdict |
|---|---:|---:|---|
| T0 | 2 | 13 | Keep behavioral core |
| T1 | 13 | 161 | Useful; trim, relocate or repair narrow assertions |
| T2 | 12 | 48 | Replace/consolidate; substantial deletion candidates inside |
| T3 | 7 | 21 | Purge entire suites, salvaging only explicitly identified owning-package regressions |
| Excluded | 1 | 0 | Inherited case moved |

Case estimates expand the image parser matrix to 78 and optional browser matrix to 4. They are not a measured runner discovery count, and individual cases can contain many looped scenarios. The seven T3 files alone contain **3,098 lines**; there is additional substantial purge material in mixed suites. Line counts describe audit scope, not the reason for deletion.

## The worst offenders

1. **A fake TanStack implementation is being tested as TanStack behavior.** `superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts:150` implements a Map-based `ContractCacheHarness`; `:365` implements `ContractRouterHarness`. Navigation assigns a local variable. Invalidating a route pushes a string into a local array. The tests then celebrate those strings. `:973` implements offline replay with an array and an `online` boolean; `:818` aborts before making the request. No real TanStack Router or Query client is instantiated. **Delete all 1,131 lines.** The HTTP demo calls do not rescue the claimed coverage.

2. **Production chaos is fictional.** In `superapp-portfolio/api/effect/index.ts:470`, `modules.map` computes `degraded` and `ok` from strings such as `remote-down`, `clock-skew` and `restart-during-load`. No remote is stopped, no clock is changed, and nothing restarts. At `:528`, `productionChecks` concatenates workflow/invariant/route descriptions. `pilot-chaos.test.ts:215` checks those lists have 13 or 12 items. `browser-runtime-matrix.test.ts:950` renders those same booleans as “simulated MF fallback.” The portfolio config installs BFF and TanStack, **no Module Federation plugin**. **Purge these certification scenarios.**

3. **The chaos suite tests the machinery it invented.** `chaos-toggles.test.ts:640` loops a ten-row taxonomy; the fixture's interceptor (`api/effect/index.ts:788`) manufactures each expected Response from the same taxonomy (`:242`). Auth expiry, slow stream and downstream timeout are names attached to synthetic envelopes. A minimal request-isolation test might survive; **the 878-line taxonomy certification should not**.

4. **The security certification is an app-level pretend security system.** `security.test.ts:146` calls the fixture's `createSecurityDecision` (`api/effect/index.ts:327`): it accepts a `Bearer ` prefix, trusts a caller-supplied role header, checks a literal `superapp-valid-csrf`, and consults hard-coded tenant tables. Failed policy throws a generic error, and the test accepts any status >=400, including 500. **This cannot certify framework auth, CSRF or tenant isolation. Purge it.** Retain only a separate real framework error-redaction regression if uncovered.

5. **Volume and prose are being mistaken for coverage.** `superapp-portfolio/tests/index.test.ts:125` locks 106,960 records plus thirteen exact record totals. At `:288`, every domain must have at least three workflow strings and three invariant strings. At `:336`, stress metadata must claim concurrency >=8 and nightly metadata >=1 hour. These assertions reward larger fixture descriptions; they execute no such workloads. **Delete the metadata/count block.**

6. **A test of Effect itself is called server cancellation.** `effect-bff-contracts.test.ts:195` constructs and interrupts a fiber entirely inside the test process. No BFF request is canceled. The token non-leak check at `:279` calls `not.toContain` on an array of body strings; it rejects only an entire body equal to the token. A leaking JSON body passes. A cheap native check confirmed `[JSON.stringify({error:'schema-secret-token'})].includes('schema-secret-token') === false`. **Remove the fiber demonstration; repair and retain real HTTP decoding/redaction tests.**

7. **MF reliability is mostly fixture reliability.** `routes-tanstack-mf/test/remote-loader-reliability.test.ts` imports a retry/timer implementation from the fixture's own `remoteLoaderCore.ts`. Four cases never call the real federation loader. The browser failure matrix in `test/index.test.ts:1001` replaces loading with a rejected promise, never-settling promise or Error containing “version skew” (`mf-host/src/routes/mf/remoteLoader.tsx:79`). **Purge those fake loader scenarios.** Preserve real native realm navigation and host/remote action integration.

## Infrastructure traps and overstated claims

- **Remote SSR is not proven by a spinner.** `i18n/mf/test/app-level-ssr-serve.test.ts:219` says “should server render app-level remote route” but asserts only a loading marker, locale and absence of a fallback reason. It never asserts remote server content. Its “one React renderer” case checks manifest flags rather than renderer identity. `conditionalTest` here is active (`i18n/test-utils.ts:5`), not skipped.
- **Another SSR case only observes hydrated browser text.** `routes-tanstack/tests/index.test.ts:96` permits CSR to satisfy its SSR claim. Its prefetch test (`:125`) starts listening before initial load and has no pre-hover negative control, so eager loading can pass as intent prefetch.
- **Certification artifacts can report zero failures after a test fails.** `deploy-certification.test.ts:410` and portfolio `security.test.ts:135` summarize arrays containing only `ok:true` checks; a throwing check never appends `ok:false`. The test runner exit can still fail, but the summary is not independently reliable. Pilot chaos writes `failedCount:0` literally.
- **Nightly and stress have no meaningful resource budgets.** They record timings but never gate latency/memory/event-loop behavior. `portfolioMetrics.ts:19` measures the test runner's event loop, not the app server's. Nightly injects a failure and resets it before doing work. Repeating that 30 times does not establish recovery or soak stability.
- **Default skips are explicit, not dead code.** MF deployment, portfolio security/stress/pilot/nightly require environment flags; the certification runner enables them. Default framework green does not mean they ran. Full browser mode adds Firefox/WebKit, but nightly inherits release's Chromium desktop smoke and then runs it again in the full matrix.
- **Repeated build suites buy mostly manifest snapshots.** `tanstack-mf-contract.test.ts:58` builds three apps, retrying each up to four times for dist races, for two manifest assertions. `create-routes-contract.test.ts:33` queues behind the real suite and rebuilds solely for one route.json object. Eliminate those separate rebuild paths.
- **Do not throw away meaningful counts just because they are counts.** The image parser suite's subprocess timeouts catch hangs; valid-image controls prevent a reject-everything fix. Its 78-case matrix deserves pruning for equivalent internal exports, not blanket deletion. Build-counter assertions in `fixture-typecheck` prove cache behavior and are useful.
- **Generated output contracts are not source-text tests by definition.** Public sitemap/robots generation checks real externally consumed output. In contrast, Tailwind's `pluginTailwindcss()` substring can pass with a commented-out plugin and never proves CSS processing. Exact declaration ZIP inventories do not prove any consumer can use the types.

## Minimal survivor set

Retain these capabilities, using fewer fixtures and shared builds:

- One real Effect BFF production integration: HTTP/query/payload/RPC, generated browser SDK, error mapping, rejected malformed input without mutation, context/trace ancestry. Small dev smoke only.
- Cross-project hosted and independent Effect SDK transport plus the added producer policy denial/acceptance checks. Remove the duplicated injected-transport envelope test.
- Actual published declaration consumers, including NodeNext and a nested route. Keep inherited tests out of the purge scope; fail all unexpected compiler diagnostics.
- TanStack routes/actions/fetchers/blockers and actual RSC composite SSR/client slots. Fix the weak SSR/prefetch claims rather than counting them as coverage.
- Localized native Link/changeLanguage with reload sentinels, raw SSR, optional aliases, active state and API-prefix exclusion.
- A real two-remote production browser flow: CSS arrives, remote fetcher updates host state, native links preserve host identity and both realm locations. Staged artifacts without fixture source remain worthwhile. Add one real unavailable-remote/recovery scenario instead of many synthetic error strings.
- One compact JS-disabled SSR/forced-CSR check and one asset-prefix request/browser check, salvaged from the 1,013-line portfolio matrix.
- One browser route+mutation smoke under bounded concurrent HTTP traffic, optionally reused across distinct browser engines. Drop the demo metadata, ERP record counts and synthetic pilot taxonomy.
- Generated workspace builds and serves a real Effect vertical; Tailwind-on demonstrates computed utility styling, off builds without it. Keep concise invalid-option/cohort rejection and real public-surface generation.
- Hostile image bytes bounded in child processes, valid controls and offset-view regression; trim genuinely equivalent internal-export repetition. Keep infrastructure cache invalidation regressions as cheap unit tests.

The per-file decisions and scenario-specific line evidence are in `integration_added-review.json`. T2 means “retain a small real contract and delete the surrounding apparatus,” not “rewrite the same volume with prettier helpers.”
