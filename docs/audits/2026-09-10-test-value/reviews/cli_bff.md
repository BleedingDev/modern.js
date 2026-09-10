This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# CLI/BFF additions: test-value audit

Snapshot: `4092c606b0`, comparison `origin/main...HEAD`. Read all 32 assigned suites, added hunks in the three modified suites, relevant fixture/assertion helpers, generated plugin template, and the owning `bff-effect` edge suite. This is a static value audit; no package builds or test runs were performed. No product/test files changed.

**Verdict: keep the security and actual code-execution tests; cut the parallel copy of the same runtime suite, package-configuration snapshots, fake runtime integration, and the homemade static-analysis project living inside a package test.**

The JSON companion contains a row for every assigned suite, including case-level evidence. Estimated expanded additions: **244 cases**. One file has no newly added case and is excluded. Suite ratings: **5 T0, 11 T1, 12 T2, 3 T3, 1 EXCLUDED**. A T1/T2 suite can contain individual T3 purge candidates; suite totals must not hide those.

## Deletion menu

| Candidate | Recommendation | What survives elsewhere |
| --- | --- | --- |
| `plugin-bff/tests/effect-edge-runtime.test.ts`, whole file, 546 lines / 12 cases | **Purge.** Eleven runtime case bodies exactly match the `bff-effect` owner after normalizing one import path. The only extra case is the false consumer proof below. | [packages/server/bff-effect/tests/effect-edge-runtime.test.ts:15](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/effect-edge-runtime.test.ts#L15) onward; real published-export bundle smoke. |
| `plugin-bff-extensions/tests/cross-project-generation.test.ts`, whole file, 19 lines / 2 cases | **Purge.** One export roster and two source snippets. | `plugin-bff/tests/regression.test.ts:505` actually executes generated defaults. |
| `plugin-bff/tests/pure-runtime-compatibility.test.ts`, whole file, 26 lines / 1 case | **Purge.** Four identity comparisons restate re-export syntax and forbid harmless wrappers. | Public Node/edge behavior in `backend-federation-compatibility.test.ts:38`, `:110`, `:129`. |
| `plugin-bff/tests/package-surface.test.ts`, whole file, 100 lines / 5 cases | **Purge configuration policing; consolidate any required export/type acceptance into real consumer smoke.** It checks manifest values, paths, file existence and declaration text. | Built public import/bundle tests; add/retain a genuine CLI declaration consumer check if this type surface matters. |
| `plugin-bff/tests/built-edge-package-surface.test.ts:246` seven rows plus test-only scanner `:9` | **Purge the helper-testing project.** Its only customer is another test. Retain three real public browser bundles at `:177`. | Actual target runtime/build behavior. |
| `plugin-bff-extensions/tests/hono-cross-project-policy-source.test.ts`, whole file, 103 lines / 3 cases | **Purge after retaining existing binder/adapter checks.** Source import regex plus two thinner copies. | Binder Response behavior at `hono-route-binder-source.test.ts:66`; real adapter forged-route denial at `plugin-bff/tests/honoAdapter.test.ts:96`. |

The first four files total **791 lines / 20 cases**. This is deletion scope, not a quality score. The 1,757-line federation suite is substantially more valuable than several of these tiny files.

## Claims that their own helpers disprove

1. **“Consumer builds without a direct Effect dependency” is not tested.** `plugin-bff/tests/effect-edge-runtime.test.ts:376` creates package.json but never installs the fixture. At `:473` it aliases the public entry directly to monorepo source and at `:477` does the same for security code. It builds through repository dependencies, never executes output, then bans strings at `:533`. A broken published export or missing consumer dependency can go undetected.

2. **“Executes … through the shared runtime” uses a fake runtime.** `plugin-bff/tests/effect-client-generator-data-platform.test.ts:171` runs a helper whose `:78-93` literally implements its own `createGeneratedEffectClient`, adding test-only `__config`/`__manifest` properties and methods that echo `{ request, descriptor }`. The extension copy repeats this at `effect-client-generator.test.ts:41-94`. All generated imports are intercepted. Keep generator metadata assertions and the real declaration typecheck at legacy `:237`; replace the fake request roundtrip with one actual generated-client request. Do not call it batching or transport integration.

3. **“Matching producer config” passes unresolved template tokens.** `plugin-bff/tests/cross-project-api-plugin.test.ts:66` imports raw `src/utils/crossProjectApiPlugin.ts`, whose `:7` is `'{prefix}'` and `:11` is `'{runtimeFramework}'`. The test supplies and expects those same imported constants. Replace this with execution of a rendered plugin using a real producer prefix/runtime/requestId.

4. **“Effect runtime identity” replaces Effect itself.** `plugin-bff/tests/effect-source-loader.test.ts:178` writes fake plugin export implementations at `:231-245` and a fake Effect package exposing only `Symbol('effect-schema-missing')` at `:247-259`. Delete this fixture. The owning extension loader suite at `effect-source-loader.test.ts:18` already uses installed Effect, compares `Schema.String` identity and executes a real codec in CJS/ESM.

5. **The edge remotes-array test never reaches remote resolution.** `plugin-bff-extensions/tests/backend-federation-runtime.test.ts:886` injects `entryPolicy.evaluateCommonJs`; `src/backend-federation/edge.ts:93-102` rejects the presence of `entryPolicy` immediately. It can pass even if array-supplied network entries are mishandled. Replace input with a network array and no evaluator to exercise the claimed branch.

6. **Hono parity is not end-to-end adapter wiring.** `plugin-bff/tests/hono-adapter-parity.test.ts:40-47` hand-installs middleware instead of using HonoAdapter. The 24-row table can pass if the adapter stops installing policy. Three “schema” rows expect HTTP 200 with handmade `HandleSuccess`/`InputValidationError`/`OutputValidationError` objects: [packages/server/bff-core/src/adapter-kit/parity-scenarios/schema.ts:5](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-core/src/adapter-kit/parity-scenarios/schema.ts#L5), `:20`, `:35`. The fixture at `parity.ts:54-67` performs a `typeof` check and returns those objects; no schema validator is exercised. Purge those three rows and move the useful allow/deny cases through the actual adapter.

7. **“Missing and 404 handlers only for web middleware” only tests missing.** Extension `effect-adapter-runtime.test.ts:548` has no configured entry, no actual 404 response and no non-web counterpart. Fold its useful missing-entry branch into the real prefix/runtime scenario or replace with the advertised branches.

## Other source/count policing to cut

- Extension `package-surface.test.ts:122`: exact branding URLs, keywords, scripts, Node version and publishConfig. `:153`: exact dependency roster. `:172`: exact RC cohort plus source regex. `:285`: exact namespaces. `:361`: declaration layout, nonempty text, `export` keyword, target uniqueness. `:417`: forbidden convenience names. These are manually synchronized configuration snapshots, not consumer acceptance.
- Extension `effect-client-generator.test.ts:97`: exact two export rosters. `:184`: exact import/query/spread-order snippets, despite legacy `effect-source-loader.test.ts:623` actually executing collision behavior.
- Extension `hono-cross-project-policy-source.test.ts:48`: only reads two source files and bans spellings; cannot prove transitive edge safety.
- Legacy `regression.test.ts:28`: 130 lines largely mirror package manifests and peer declarations. `:159` freezes an external dynamic-import kind instead of trying built CLI/Hono loading with optional peers absent.
- Legacy `built-edge-package-surface.test.ts:228`: **exactly one** guarded async-hooks probe. Harmless bundler changes can alter this number. The self-written scanner also bans identifiers rather than proving behavior.
- Extension `effect-source-loader.test.ts:271`: exactly two cached `.mjs` files. Keep first/second revision results and cleanup, drop the internal storage-count requirement. Its watched-input sets are meaningful watcher contracts and should not be lumped together with this cache-layout assertion.
- Legacy `generator-global-vars.test.ts:247`: unchanged inode/mtime/size is stronger and more fragile than necessary; retain unaffected content plus executed injected values.

## Duplication with concrete owners

| Legacy/thinner test | Existing stronger owner |
| --- | --- |
| All 11 edge runtime cases at CLI `effect-edge-runtime.test.ts:18-374` | Server `bff-effect/tests/effect-edge-runtime.test.ts:15-387`; exact normalized bodies verified. |
| CLI loader native CJS `effect-source-loader.test.ts:282` and ESM `:312` | Extension loader combined native module-boundary case `:82`. |
| CLI fake Effect identity loader `:178` | Extension installed Effect identity/codec test `:18`. |
| Extension Hono middleware wrong-route `hono-cross-project-policy-source.test.ts:65`, binder `hono-route-binder-source.test.ts:44` | Actual CLI HonoAdapter case `honoAdapter.test.ts:96`. Keep one thin Response-preservation case separately. |
| Extension generated default snippets `cross-project-generation.test.ts:11` | CLI generated runtime execution `regression.test.ts:505`. |
| Extension worker spread-order source `effect-client-generator.test.ts:184` | CLI generated wrapper correct hash accepted/configured collision rejected `effect-source-loader.test.ts:623`. |
| Federation inline legacy manifest `backend-federation-runtime.test.ts:1618` | Same suite inline manifest path `:945`. |
| CLI federation smoke/denials `regression.test.ts:239/:264/:288/:315` | Extension federation owner `backend-federation-runtime.test.ts:572/:731/:335/:1514`. |

The name-mismatch, missing-runtime, nonobject-module and unknown-remote rows at CLI `regression.test.ts:333/:343/:360/:368` have additional validation value. Move those into the owner's compact metadata/error matrix before deleting the catch-all; do not lose them incidentally.

## Smallest useful surviving structure

- **Federation execution/security:** one owning suite with live HTTP manifest/container success and wrong-build rejection (`backend-federation-runtime:985`), tampered/unverified-byte nonexecution, trusted-provider overrides, local/network path separation, per-runtime isolation, shared deadline cancellation, and identity disagreement checks. Remove repeated namespace and legacy-warning ceremony. One public Node/edge compatibility smoke, including built ESM file/data loading (`backend-federation-compatibility:129`).
- **Effect adapter lifecycle:** keep runtime across prefixes, batch policy on mounted routes, disposal failure, and dispose-during-load (`effect-adapter-runtime:18/:165/:361/:454`). Actual acquire/release counts are meaningful resource correctness.
- **Loader/compiler:** retain installed Effect identity, native ESM/CJS behavior, TypeScript/JSX/transitive workspace resolution, reload invalidation and publication race. Keep one actual Rspack graph/forbidden browser import (`effect-worker-api-graph:9`), one generated worker response/contract collision/disposal fixture, and actual global-variable compilation (`generator-global-vars:28/:149`).
- **Request/security:** keep real per-item batch enforcement, verified namespace versus spoofing, and policy-before-interceptor/body parsing (`effect-cross-project-policy:424/:385/:545`). For Hono retain actual adapter forged-route denial and invalid Retry-After safety, then a compact integration allow/deny table.
- **Generation/publication:** one generated-client request with actual runtime plus real declaration consumer typecheck; one generated producer configuration/defaults/export-collision fixture. One centralized packed/public entry acceptance test, including CLI/Hono without optional Effect peer. Do not duplicate package.json values in every package suite.

The extension package's `pretest` builds itself; CLI package test script does not. These suites mix source imports, package specifiers, absolute built paths and source aliases. A single clear artifact-acceptance stage would remove redundant builds and stop source-only tests from being mistaken for published-package proof. No wall-clock saving is claimed because this audit did not benchmark execution.

## Scope exclusion

`packages/cli/plugin-bff/tests/clientGenerator.test.ts` has six inherited cases and zero newly added cases in this comparison. Only the first case's title/assertion was revised. Do not call these six UltraModern additions. In `honoAdapter.test.ts` audit only the added case at `:96`; in `server.test.ts` audit only `:107` and `:131`.
