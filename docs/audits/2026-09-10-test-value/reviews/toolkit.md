This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# Toolkit and miscellaneous CLI test-value audit

Audited commit `4092c606b0` in `/tmp/ultramodern-test-audit-20260910`, against `origin/main...HEAD`. Reviewed all 27 assigned test files plus the separately discovered Sandpack build smoke, their assertion-bearing fixture runners, and relevant implementation/configuration. Existing upstream cases are excluded from the new-case count. No tests or implementation were deleted or changed.

**Verdict: 2 entire suites are immediate purge candidates. Seven more individual cases are obvious dead weight. The largest bulk cut is the duplicated backend-federation validator matrix, followed by repeated native-CLI permutations.**

The JSON companion contains a row for every file, precise line references, mixed-suite survivor recommendations and confidence. Counts: T0 8 files; T1 12; T2 5; T3 2; EXCLUDED 1. Approximately 183 newly registered cases across top-level files; native child runners contain additional cases (21 compat-require subtests, 3 strict-CLI format subtests) and many input permutations. This is an inventory estimate, not a usefulness metric.

## Tiers

- **T0 — earns its keep:** actual behavior or boundary failure with a strong oracle.
- **T1 — useful, carrying baggage:** preserve its useful behavior and cut repetitions or overprecise assertions.
- **T2 — replace/consolidate:** weaker evidence than its size/title implies, or repeated coverage better owned elsewhere.
- **T3 — purge:** source/config policing or a test that mainly proves the test's own fixture/helper.
- **EXCLUDED:** inherited or mechanical-only changes.

## Delete these first

| Candidate | Exact evidence | Why it is dead weight |
|---|---|---|
| Entire `tooling-cohort.test.ts` | lines 12–41 | Copies pnpm/Oxc version literals and historical release-age exclusions into a second file. Updating dependencies demands updating the “test.” No install or tool execution occurs. |
| Entire Sandpack `profile.test.ts` | lines 33–106 | Writes already-exported strings to disk, reads them back, then checks package versions and magic source tokens. “Executable” appears in the title but no capability executes. |
| Preset asset test | `preset.test.ts:137` | Pins literal SVG colors/text markup and PNG header/dimensions. Does not render a logo or verify hosted assets. |
| Export-existence test | `code-tools.test.ts:84` | Later imports and actual runner calls already prove the useful portion. A defined rule object can still be broken. |
| Test-local clean-output regex | `oxlint-output.test.ts:120` | Exercises only test literals against a regex declared in the test. Production can be broken or absent and this case remains green. |
| “Recovery” of a stateless file-read helper | `createFileWatcher.test.ts:39` | Repeats successful read and ENOENT; there is no state to recover. |
| Provider's name | `surfaceResolutionEnvStatic.test.ts:62` | Compares a field with the same exported constant the implementation uses. |
| Duplicate static-trust marker | `surfaceResolutionEnvStatic.test.ts:392` | Already asserted by the full happy-path result at line 66. |
| Test-authored provider SPI | `surfaceResolutionRecord.test.ts:335` | The test writes its own resolve function and checks the values that very function was written to return. No real consumer or provider is exercised. |

That is **4 cases in two whole files, plus 7 individually removable cases**. These are recommendations for approval, not deletions performed.

A cheap adversarial probe strengthens the Sandpack finding: I imported its string map, prefixed every line of the five capability files with `// ` in memory, and reran all ten capability regex assertions. **All 10 still passed with every executable line disabled.** No repository source was modified. These assertions demonstrably cannot distinguish advertised capabilities from commented-out code.

## The largest consolidation targets

**Backend federation contract validation: 55 registrations across two suites should become roughly 12–15 coherent contract cases.** `backendFederationContractMatrix.test.ts:178` multiplies three fields by three absence/blank variants; line 190 adds three fields by four non-string types; lines 202 and 219 replay absence/blank variations through two nesting positions. Production routes these through the same `nonEmptyString`/identity helpers. Keep one helper input-category table, one wiring case per nested boundary, mismatch detection, metadata compatibility normalization, and the distinct root/surface build-alias branches. Delete duplicated happy paths, blank identity, source-revision and missing-api-build cases from `backendFederationContract.test.ts`. Preserve its surface-identity mismatch at line 159.

**Strict Effect: keep the detailed AST matrix once, then a minimal native smoke per format.** `strict-effect-runtime.test.ts` and `fixtures/strict-effect-cli/cases.mjs` both carry direct/shared/factory/alias, comments, strings, spoofed imports, shadowed roots and dead-return variants. The built helper runs its fixtures for CJS, ESM and ESM-node. These formats deserve native execution because namespace loading differs, but every AST permutation does not need a full three-format replay. The helper additionally generates ten ERP service IDs at `run.mjs:147`; one representative generated service exercises the shared generation/lint path. It formats files at line 171 then immediately invokes formatter check at line 182: drop the second invocation. Keep real worker execution, one deliberate parser infrastructure failure per relevant classification, operational-vs-source error separation, and temporary directory cleanup.

**Code-tools runner cases: trim setup and duplicated positives.** `code-tools.test.ts:195` can join the accepted non-visible/generic source fixture at line 94. The renamed-locale binding fixture at line 490 can replace or extend the more restricted success runtime fixture at line 221. Keep actual runner dispatch/extension checks and distinct diagnostics; group related negatives into one fixture invocation rather than repeatedly spawning native Oxlint. Remove or narrow line 654: malformed runtime registration stops scanning before plural-resource validation, so the title promises more than the assertions establish.

**Surface parser and record positives:** `surfaceResolutionRef.test.ts:13–39,88,101` repeatedly run the same valid references through parsing, formatting and round trips. One table can check parsed structure plus round trip. Merge `surfaceResolutionRecord.test.ts:251` into its complete valid record. Keep malformed-wire-data totality, wrong-unit/build identity and versioned-address rejection; these are real failure modes.

## Weak infrastructure to replace

- `createFileWatcher.test.ts` only exercises `safeReadFileSync`. All four cases can pass if add/change event handlers stop using that helper. Prefer one real watcher callback regression for a vanished file plus one non-ENOENT control. Do not call the current suite proof that the reported watcher crash is fixed.
- The fork's two added assertions in `adapter-rstest/tests/index.test.ts` check forwarded `disableReactCompiler` and emitted `output.module`. The upstream resolver is mocked, so they cannot prove tests affected by React Compiler actually load/run. Replace these added assertions with a real adapter fixture if retaining regression coverage; the surrounding upstream test is out of scope.
- The reenabled cache case in `utils/tests/compatRequire.test.ts` stuffs a fake NodeModule into `require.cache` and mirrors the format branch in its expectation. Replace that case with native load/change/clear/reload behavior. Native built interop already covers actual ESM cache busting.
- `types/tests/reexports.test.ts:46–49` only checks diagnostic text, never process status/signal/error. Keep real declaration compilation, share a compiler harness with the Node-only consumer test, and require a successful child. The two compiler scenarios are not identical: the broad declaration check globally enables React types, while `cli-react-types.test.ts` intentionally does not.

## The Sandpack acceptance inversion

[packages/toolkit/ultramodern-sandpack-profile/package.json:36](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-sandpack-profile/package.json#L36) defines default `test` as `tests/*.test.ts`, which runs the static T3 profile suite. The real build smoke requires the separate `test:build-smoke` at line 37. No references to `profile-build`, `test:build-smoke` or `ultramodern-sandpack-profile` were found in `.github/workflows`, `scripts`, root `package.json` or `nx.json` at this commit.

Retain `profile-build.smoke.ts:61`: it materializes a project and invokes the real Modern CLI. Its limit is explicit: it symlinks repository `node_modules` at line 48, so it does not install the published npm aliases or prove visible routing/i18n/Effect behavior. Its artifact checks prove a build emitted HTML and JS, which is useful but narrower than “every capability works.” Put this survivor in the intended acceptance lane when deleting the static default suite.

## Minimum suite worth keeping

1. Real localized loader/action URL matching with basepaths, encoded parameters and wrong-ID rejection; real production loader/deferred error redaction.
2. Native built CJS/ESM exports that parse YAML, invoke plugin factories, preserve namespace/payload semantics, handle cycles/JSON, and reload changed ESM. Keep both emitted async-storage formats preserving context across an await.
3. One public declaration compiler harness supporting broad re-export resolution and the Node-only React consumer condition.
4. Compact actual linter accept/reject tests for supported rules, detailed AST provenance once, one native worker smoke per shipped format, and visible operational failures.
5. One small contract-validation suite, plus env/static resolution precedence, external-major isolation, production no-localhost fallback, and whole-record rejection.
6. Public reference grammar/format boundaries and malformed serialized records/identity mismatch.
7. Real config loading/order/configless behavior; one watcher event regression instead of a pile of wrapper tests.
8. One docs-preset merge/URL/plugin-wiring test and the materialized Sandpack build smoke.

Do not delete functional tests merely because they pass source strings as inputs. A linter's product input is source text. The meaningful distinction is whether the test executes the production linter and observes its output, or merely looks for magic tokens inside the repository. Likewise, checking that emitted build artifacts exist is a legitimate prerequisite when followed by real execution; the async-storage and module interop suites do exactly that.

## File inventory

| Tier | File | Disposition |
|---|---|---|
| T2 | `packages/cli/adapter-rstest/tests/index.test.ts` | Replace the two added assertions with a real adapter-run regression when that harness exists; leave inherited case alone. |
| T0 | `packages/cli/plugin-data-loader/tests/localised-loader.test.ts` | Keep all three scenarios. |
| T0 | `packages/cli/plugin-data-loader/tests/server.test.ts` | Keep the two new production-redaction scenarios; exclude existing/reenabled routing case from added-case count. |
| EXCLUDED | `packages/cli/plugin-ssg/tests/lib.test.ts` | Exclude from fork-added audit. |
| T1 | `packages/document/ultramodern-preset/tests/preset.test.ts` | Purge asset/source policing and copy pins; retain one preset-composition test and one metadata wiring test. |
| T0 | `packages/toolkit/code-tools/tests/cli-react-types.test.ts` | Keep; share the compiler harness with reexports.test.ts if consolidating infrastructure. |
| T1 | `packages/toolkit/code-tools/tests/code-tools.test.ts` | Retain genuine CLI rule cases; remove export-existence test, collapse overlapping accepted fixtures, and fix misleading multi-defect scenarios. |
| T0 | `packages/toolkit/code-tools/tests/compatRequireBuilt.test.ts` | Keep native build-artifact interop; trim a few equivalent payload variants only if reducing this family. |
| T1 | `packages/toolkit/code-tools/tests/oxlint-output.test.ts` | Keep diagnostic preservation/crash propagation; purge test-local clean-output-contract case and stop pinning the exact clean summary format. |
| T1 | `packages/toolkit/code-tools/tests/strict-effect-cli-built.test.ts` | Keep one build-format smoke per shipped format; run detailed spoof matrix once and reduce the ERP-name repetition. |
| T0 | `packages/toolkit/code-tools/tests/strict-effect-resolver.test.ts` | Keep. |
| T1 | `packages/toolkit/code-tools/tests/strict-effect-runtime.test.ts` | Keep detailed validator unit matrix here; deduplicate its common cases from the built-CLI matrix. |
| T3 | `packages/toolkit/code-tools/tests/tooling-cohort.test.ts` | Purge entire file. |
| T1 | `packages/toolkit/plugin/tests/createConfigOptions.test.ts` | Keep two cases; strengthen the first assertion only when touching it. |
| T2 | `packages/toolkit/plugin/tests/createFileWatcher.test.ts` | Replace four helper cases with one watcher-event regression plus one non-ENOENT control; purge redundant fourth case immediately. |
| T0 | `packages/toolkit/runtime-utils/tests/build-artifact/async-storage-externals.test.ts` | Keep both emitted ESM formats. |
| T1 | `packages/toolkit/runtime-utils/tests/node/serialize.test.ts` | Keep import-time side-effect and unsafe-script behavior; merge undefined case and prefer semantic escaping assertions over exact encoding style. |
| T1 | `packages/toolkit/types/tests/reexports.test.ts` | Keep declaration compilation; consolidate compiler infrastructure and assert subprocess success explicitly. |
| T3 | `packages/toolkit/ultramodern-sandpack-profile/tests/profile.test.ts` | Purge entire file; use the existing build smoke as the survivor. |
| T0 | `packages/toolkit/utils/tests/alias.test.ts` | Keep the four added filesystem-resolution cases; leave inherited getUserAlias test out of scope. |
| T2 | `packages/toolkit/utils/tests/backendFederationContract.test.ts` | Consolidate with backendFederationContractMatrix.test.ts into one small contract suite; do not keep both families as-is. |
| T2 | `packages/toolkit/utils/tests/backendFederationContractMatrix.test.ts` | Cut the 49-case multiplication to roughly 12-15 contract scenarios shared with backendFederationContract.test.ts. |
| T2 | `packages/toolkit/utils/tests/compatRequire.test.ts` | Replace only the reenabled cache case with one native child-process load/change/clear/reload check; leave inherited cases alone. |
| T0 | `packages/toolkit/utils/tests/compiledYamlExports.test.ts` | Keep the two native package export checks. |
| T1 | `packages/toolkit/utils/tests/surfaceResolutionEnvStatic.test.ts` | Keep precedence/fail-closed/versioned materialization coverage; purge provider-name and duplicate trust-marker checks and merge repeated happy paths. |
| T1 | `packages/toolkit/utils/tests/surfaceResolutionRecord.test.ts` | Keep untrusted-record validation and identity/selection behavior; purge test-authored provider SPI case and consolidate scalar positives. |
| T1 | `packages/toolkit/utils/tests/surfaceResolutionRef.test.ts` | Keep grammar/error-code and direct-format validation; merge positive parse/format/round-trip repetition into one table. |
| T1 | `packages/toolkit/ultramodern-sandpack-profile/tests/profile-build.smoke.ts` | Keep as the replacement for profile.test.ts and connect it to the intended acceptance lane; strengthen to request/render output only when needed. |

Validation performed: static inspection of added assertions, implementation and runner/discovery commands; the in-memory Sandpack adversarial probe. No package install, framework build or expensive suite execution was performed. Confidence is high in the cited dead tests/duplication; runtime cost reductions are qualitative, not measured benchmarks.
