The entries below are deletion candidates, not deletion authorization. Modified upstream files retain all inherited tests. Where the recommendation names a replacement or a survivor, that condition remains part of the decision.

**S009 · [packages/cli/builder/tests/rsdoctor.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/builder/tests/rsdoctor.test.ts)**

Purge the suite; cover opt-in through one real profiling build only if fork-specific behavior needs it.

Added suite; disposition and scenario exceptions govern. Only counts constructor-named Rsdoctor plugins in a compiler created by Rsbuild. No profiling artifact, own behavior, or meaningful user failure is exercised. Returned compiler is never closed.

- S009.01 · T3 · [loads Rsdoctor when RSDOCTOR=true](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/builder/tests/rsdoctor.test.ts#L38): RSDOCTOR=true -> constructor-name count 1 re-tests upstream integration wiring.
- S009.02 · T3 · [does not add a duplicate when a build already has Rsdoctor](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/builder/tests/rsdoctor.test.ts#L50): Injects a fake isRsdoctorPlugin marker then asserts upstream duplicate suppression; fake plugin never profiles a build.

**S014 · [packages/cli/plugin-bff-extensions/tests/cross-project-generation.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff-extensions/tests/cross-project-generation.test.ts)**

Purge whole suite

Added suite; disposition and scenario exceptions govern. Two assertions-only cases freeze a namespace and two snippets. Runtime-generator execution already observes all secure defaults in plugin-bff/tests/regression.test.ts:505-565.

- S014.01 · T3 · [Exact one-export namespace](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff-extensions/tests/cross-project-generation.test.ts#L5): Export roster policing; any harmless public addition fails.
- S014.02 · T3 · [Secure-default source snippets](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff-extensions/tests/cross-project-generation.test.ts#L11): Could pass with defaults present only in a comment or dead branch; no produced configuration is executed. Covered more meaningfully by regression.test.ts:505.

**S039 · [packages/cli/plugin-bff/tests/package-surface.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/package-surface.test.ts)**

Purge whole suite once packed/public consumer smoke is retained

Added suite; disposition and scenario exceptions govern. All five cases inspect package.json, filesystem existence or declaration text. It duplicates extension package-surface and regression metadata checks while allowing broken importable modules or unusable declarations to pass.

- S039.01 · T2 · [Dist target mappings and existence](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/package-surface.test.ts#L20): Actual exported files should be consumed. Existing files can contain broken code; mapping literals lock folder layout without execution.
- S039.02 · T3 · [Exact Node engine baseline](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/package-surface.test.ts#L50): Tests a config value against the same manually maintained value.
- S039.03 · T3 · [Exact CLI declaration path](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/package-surface.test.ts#L54): Layout snapshot, not type usability.
- S039.04 · T3 · [Exact builder/esbuild dependency placement and version](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/package-surface.test.ts#L60): Manifest copy; behavior-based import/pack coverage detects actual dependency problems.
- S039.05 · T3 · [Declaration import text plus optional peer shape](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/package-surface.test.ts#L74): A declaration source substring and workspace version interpolation do not demonstrate consumer typechecking. Replace with one generated/public declaration consumer check.

**S040 · [packages/cli/plugin-bff/tests/pure-runtime-compatibility.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/pure-runtime-compatibility.test.ts)**

Purge whole suite

Added suite; disposition and scenario exceptions govern. Four function-identity assertions merely restate re-export wiring. Public compatibility behavior is already exercised in backend-federation-compatibility and built/public runtime tests.

- S040.01 · T3 · [Forwarded functions are same objects](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/cli/plugin-bff/tests/pure-runtime-compatibility.test.ts#L12): Imports source paths then asserts .toBe owner function; fails harmless wrappers and gives no consumer-resolution or behavioral assurance.

**S059 · [packages/runtime/plugin-i18n/tests/peerCohort.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-i18n/tests/peerCohort.test.ts)**

PURGE

Added suite; disposition and scenario exceptions govern. Copies peer version strings and optional flags out of package.json into a test. It proves no installation, type compatibility, or runtime interoperability; legitimate dependency updates pay a bookkeeping tax.

- S059.01 · T3 · [matches the required runtime React cohort without overstating i18n floors](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-i18n/tests/peerCohort.test.ts#L13): Hard-coded i18next/react-i18next floors and matching React manifest fields are duplicated configuration, not compatibility evidence.

**S065 · [packages/runtime/plugin-runtime/tests/boundary-debugger/index.test.tsx](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/boundary-debugger/index.test.tsx)**

Purge the current oracle; replace with visible/default control mode in the surviving debugger suite.

Added suite; disposition and scenario exceptions govern. The test explicitly hides controls, so it cannot establish that SSR hides normally visible controls. Confirmed with an in-memory mutant removing the entire production SSR guard: the current test output remains identical.

- S065.01 · T3 · [does not render debug controls during SSR](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/boundary-debugger/index.test.tsx#L6): controlMode is hidden at :9. Removing the complete !mounted SSR guard still returns <main>app</main>; visible mode exposes the mutant. See ssr-mutation-proof.json.

**S089 · [packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts)**

Purge this suite as written; any replacement must demonstrate same-request retry in the real owning integration.

Added suite; disposition and scenario exceptions govern. Confirmed mutation survivor: replacing the entire UltraModern manifest recovery plugin with a no-op preserves every asserted scenario observation. The handwritten child server manufactures status/degraded HTML and upstream MF 2.9.0 handles later-request recovery. This is fixture/upstream behavior masquerading as fork SSR assurance.

- S089.01 · T3 · [Node SSR stays alive, reports typed degradation, and recovers without restart](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts#L67): No-op plugin still yields 503/RUNTIME-003 then 200/inventory live, identical PID/alive and stderr code. Reproducible proof in ssr-mutation-proof.cjs/json.
- S089.02 · T3 · [Node SSR preserves typed manifest schema failures](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts#L145): No-op plugin still yields 500/RUNTIME-013 and stays alive. There is no Modern request handler or React SSR in the child fixture.
- S089.03 · T3 · [findRuntimePath](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/module-federation/manifest-recovery-node.test.ts#L53): Hard-codes the pnpm storage entry for upstream runtime 2.9.0; adds version/layout churn to a suite that does not detect removing our feature.

**S091 · [packages/runtime/plugin-runtime/tests/registrySurface.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/registrySurface.test.ts)**

Purge literal package.json inventory; replace only with real TypeScript consumer resolution in a packaging check.

Added suite; disposition and scenario exceptions govern. No import, declaration resolution or type checking occurs. Four exact metadata objects can all be correct while registry.d.ts is missing or unusable.

- S091.01 · T3 · [types main and named entry aliases without a runtime fallback](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-runtime/tests/registrySurface.test.ts#L5): Reads package.json and compares exports/typesVersions to a literal dist path at :14-22. It does not type either alias.

**S120 · [packages/runtime/plugin-tanstack/tests/router/fastDefaults.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/fastDefaults.test.ts)**

PURGE standalone suite; assert behavior in one real router test

Added suite; disposition and scenario exceptions govern. Two tests copy a boolean config default and object override. Neither proves structural sharing works, avoids recursion, or reaches the actual router.

- S120.01 · T3 · [enables structural sharing by default](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/fastDefaults.test.ts#L7): Copies constant literal into expectation and repeats the getter result.
- S120.02 · T3 · [allows explicit structural sharing override](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/fastDefaults.test.ts#L16): Tests ordinary option spread true/false; behavior belongs in actual router construction coverage.

**S124 · [packages/runtime/plugin-tanstack/tests/router/hydrationBoundary.test.tsx](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/hydrationBoundary.test.tsx)**

PURGE; preserve actual suspension/hydration behavior elsewhere

Added suite; disposition and scenario exceptions govern. Reads React element type/props and reference equality. It freezes a JSX wrapper implementation and never hydrates, suspends, or checks mismatch recovery.

- S124.01 · T3 · [wraps SSR hydration content in a Suspense boundary](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/hydrationBoundary.test.tsx#L5): Equivalent to asserting the helper returned <Suspense fallback={null}>children</Suspense>; no behavioral consequence.
- S124.02 · T3 · [keeps non-SSR router content unwrapped](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/hydrationBoundary.test.tsx#L16): Input identity on non-SSR path is a trivial implementation branch.

**S127 · [packages/runtime/plugin-tanstack/tests/router/packageSurface.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/packageSurface.test.ts)**

PURGE; one installed/packed import smoke should own packaging

Added suite; disposition and scenario exceptions govern. Asserts a manifest object equals a second hard-coded copy. A broken or missing dist file still passes. Legitimate package layout improvements fail.

- S127.01 · T3 · [package manifest exposes the runtime subpath used by app fixtures](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/packageSurface.test.ts#L5): No import/resolve/build of the advertised path occurs; exports and typesVersions strings are merely copied.

**S130 · [packages/runtime/plugin-tanstack/tests/router/preloadRedirect.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/preloadRedirect.test.ts)**

REMOVE from fork runtime suite; keep only if explicitly owning dependency acceptance

Added suite; disposition and scenario exceptions govern. Imports only upstream TanStack and constructs its own router with literal structural-sharing option. No Modern/UltraModern implementation is exercised. Current patch ledger describes only a TanStack declaration patch, so this is third-party runtime regression ownership.

- S130.01 · T3 · [resolves concurrent preload redirects without stale loader work](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/preloadRedirect.test.ts#L14): The concurrent redirect behavior is real, but it would pass if the entire UltraModern router integration were broken or absent. Upstream TanStack should own the detailed regression.

**S131 · [packages/runtime/plugin-tanstack/tests/router/register.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/register.test.ts)**

PURGE

Added suite; disposition and scenario exceptions govern. One typeof global registration check is completely subsumed by loading actual provider graphs in realm-isolation/routerCompatibility and server plugin setup.

- S131.01 · T3 · [registers the tanstack router provider](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/runtime/plugin-tanstack/tests/router/register.test.ts#L5): Any function, including a wrong provider left in global state, satisfies the assertion.

**S156 · [packages/server/bff-core/tests/operators/http.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-core/tests/operators/http.test.ts)**

Purge only the fork-added Upload case, preserving upstream cases

Fork changes only; preserve inherited tests. The added Upload size string-to-number happy path duplicates operators/http.matrix.test.ts Upload row (lines116-137) and the same Api invocation. The inline type alias is not a substitute for a compiler contract suite.

- S156.01 · T3 · [test('should expose validated upload formData to handler', async () => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-core/tests/operators/http.test.ts#L204): Duplicate of the more complete Upload valid/invalid matrix; no unique runtime boundary.

**S162 · [packages/server/bff-effect/tests/edge-entry-safety.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/edge-entry-safety.test.ts)**

Purge regex module crawler; retain one real edge consumer/bundler smoke

Added suite; disposition and scenario exceptions govern. A custom 100-line import resolver crawls only relative source imports, counts erased type-only imports, and bans filename words such as adapter or generator. It neither uses the real package resolver nor loads edge output.

- S162.01 · T3 · [const readStaticModuleSpecifiers = (source: string): string[] => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/edge-entry-safety.test.ts#L47): Handwritten import regex is not the TypeScript module graph and treats type imports as runtime dependencies.
- S162.02 · T3 · [for (const specifier of readStaticModuleSpecifiers(source)) {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/edge-entry-safety.test.ts#L88): Follows only relative specifiers, leaving transitive package dependencies opaque.
- S162.03 · T3 · [test('does not statically load Node built-ins or edge-excluded modules', () => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/edge-entry-safety.test.ts#L110): The sole assertion checks empty arrays produced by the homegrown crawler; source architecture policing with weak runtime evidence.

**S167 · [packages/server/bff-effect/tests/effect-batch-log-redaction.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/effect-batch-log-redaction.test.ts)**

Purge standalone duplicate after retaining operation-boundary redaction assertions

Added suite; disposition and scenario exceptions govern. effect-batch-operation-boundary already asserts raw thrown and query secrets never appear in emitted diagnostics while also checking wire errors and mixed failures. This repeats that same logger boundary with a less complete scenario.

- S167.01 · T3 · [test('never logs query secrets or raw thrown error details', async () => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/effect-batch-log-redaction.test.ts#L4): Same createDataPlatformBatchRequestHandler console.error redaction as operation-boundary lines131-134; consolidate these few negative strings there if desired.

**S183 · [packages/server/bff-effect/tests/effect-module-diagnostic.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/effect-module-diagnostic.test.ts)**

Purge exact diagnostic sentence test

Added suite; disposition and scenario exceptions govern. Loads a real module solely to compare one long warning sentence byte-for-byte. No dispatch, recovery, missing-context behavior or usable diagnostic category is tested.

- S183.01 · T3 · [expect(warnings).toEqual([](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/bff-effect/tests/effect-module-diagnostic.test.ts#L17): Exact package-name advice text is copy policing; spelling edits break the test without a product regression.

**S197 · [packages/server/create-request/tests/acceptHeader.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/create-request/tests/acceptHeader.test.ts)**

Purge standalone duplicate; keep outbound request matrix case

Added suite; disposition and scenario exceptions govern. requestFactory.outbound-contract.test.ts:118 executes the same browser GET Accept casing normalization and asserts exactly one canonical key.

- S197.01 · T3 · [test('should replace case-variant accept payload header instead of sending duplicate keys', async () => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/create-request/tests/acceptHeader.test.ts#L4): Duplicates the outbound matrix; no extra adapter path or behavior.

**S198 · [packages/server/create-request/tests/browser-get-body.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/create-request/tests/browser-get-body.test.ts)**

Purge standalone duplicate; keep outbound request matrix case

Added suite; disposition and scenario exceptions govern. requestFactory.outbound-contract.test.ts:118 already checks browser GET body stripping before the configured transport.

- S198.01 · T3 · [test('strips GET request bodies before configured browser transport', async () => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/create-request/tests/browser-get-body.test.ts#L4): Redundant successful response plus init.body undefined on the same browser request path.

**S200 · [packages/server/create-request/tests/identityBinding.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/create-request/tests/identityBinding.test.ts)**

Purge standalone duplicate after preserving outbound identity collision case

Added suite; disposition and scenario exceptions govern. The real Node entry exercises identity casing, but the same server factory path is already covered by outbound-contract line199; retain one public Node entry control in the consolidated matrix if needed.

- S200.01 · T3 · [test('should not forward case-variant protected identity headers beside server-derived binding', async () => {](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/server/create-request/tests/identityBinding.test.ts#L27): Case-variant tenant override replaced by derived identity duplicates the shared outbound matrix.

**S239 · [packages/solutions/app-tools-extensions/tests/release-envelope-plugin.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/solutions/app-tools-extensions/tests/release-envelope-plugin.test.ts)**

Purge.

Added suite; disposition and scenario exceptions govern. The type-boundary test has no typecheck. It counts three callbacks, then runs all with target vercel, which returns before any envelope work in the implementation. resolvedConfigs=[config,config,config] is plumbing theatre.

- S239.01 · T3 · [preserves the concrete config type and registers each lifecycle once](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/solutions/app-tools-extensions/tests/release-envelope-plugin.test.ts#L18): The type-boundary test has no typecheck. It counts three callbacks, then runs all with target vercel, which returns before any envelope work in the implementation. resolvedConfigs=[config,config,config] is plumbing theatre.

**S259 · [packages/solutions/app-tools/tests/index.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/solutions/app-tools/tests/index.test.ts)**

Remove new export-existence and plugin-name checks; preserve inherited tests.

Fork changes only; preserve inherited tests. Two new named exports are only toBeDefined; new Cloudflare check only looks for plugin name, without invoking its behavior. Real package/deploy acceptance should own this.

- S259.01 · T3 · [named export](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/solutions/app-tools/tests/index.test.ts#L16): Scope only newly added createPresetUltramodernConfig/presetUltramodern assertions. toBeDefined cannot show either function works; preserve inherited export assertions.
- S259.02 · T3 · [registers the Cloudflare builder plugin](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/solutions/app-tools/tests/index.test.ts#L25): Plugin registration name inventory; no Cloudflare transform/build runs.

**S281 · [packages/toolkit/code-tools/tests/tooling-cohort.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/code-tools/tests/tooling-cohort.test.ts)**

Purge entire file.

Added suite; disposition and scenario exceptions govern. A dependency-upgrade tripwire with no functional oracle. It requires updating expected literals alongside the manifest change and permanently guards against historical one-shot exclusions.

- S281.01 · T3 · [Reviewed pnpm/Oxc versions](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/code-tools/tests/tooling-cohort.test.ts#L12): Hardcodes pnpm@11.24.0, oxfmt0.66.0, oxlint1.81.0 and mise line spelling. Successful assertions say nothing about installation or lint behavior.
- S281.02 · T3 · [Superseded release-age exclusions](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/code-tools/tests/tooling-cohort.test.ts#L28): Regexes and substring bans on historical config entries; this is cleanup archaeology, not a regression scenario.

**S289 · [packages/toolkit/ultramodern-create/tests/agents-contract.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/agents-contract.test.ts)**

Purge entire suite

Added suite; disposition and scenario exceptions govern. Editorial lint disguised as testing. No executable behavior, broken user workflow, or meaningful compatibility contract is tested.

- S289.01 · T3 · [150-word cap](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/agents-contract.test.ts#L28): Arbitrary count. Delete.
- S289.02 · T3 · [Brand phrase, command spelling and banned prose](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/agents-contract.test.ts#L34): Freezes wording and placement instead of verifying useful documentation links or working commands.
- S289.03 · T3 · [No vertical AGENTS.md](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/agents-contract.test.ts#L51): Structural taste; no demonstrated user failure.

**S307 · [packages/toolkit/ultramodern-create/tests/generated-type-contracts.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/generated-type-contracts.test.ts)**

Purge suite; replace with generated-app compile/runtime acceptance

Added suite; disposition and scenario exceptions govern. Title promises checker/runtime type contracts but every assertion is source regex or package-export literal; no compiler, importer or runtime runs.

- S307.01 · T3 · [Exact i18n package export object](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/generated-type-contracts.test.ts#L21): Source manifest spelling does not prove export resolves; move one real import into public package smoke.
- S307.02 · T3 · [Plugin order and checker flag regexes](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/generated-type-contracts.test.ts#L55): Can pass dead code/comments and freezes implementation.
- S307.03 · T3 · [Requires I18nInstance type assertion](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/generated-type-contracts.test.ts#L81): A cast is demanded as proof of type correctness; precisely backwards.
- S307.04 · T3 · [Requires JSX annotation, Record<string,never> and void props](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/generated-type-contracts.test.ts#L99): Syntax micro-management; refactors fail while invalid behavior can pass.

**S328 · [packages/toolkit/ultramodern-create/tests/shared-api-assembly.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/shared-api-assembly.test.ts)**

Purge suite; replace only with one real generated shared API request

Added suite; disposition and scenario exceptions govern. All six cases inspect generated text or regex. They freeze imports, export names, primitive choices and an Effect release literal without compiling or serving the generated API.

- S328.01 · T3 · [Generated shared BFF assembly spelling](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/shared-api-assembly.test.ts#L16): Source composition policing; behavior can break while these strings remain.
- S328.02 · T3 · [Effect release source assertion](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/shared-api-assembly.test.ts#L60): A pinned release literal is not runtime compatibility.
- S328.03 · T3 · [Migration emits named AST helper](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/shared-api-assembly.test.ts#L84): Purge file-existence plus checker helper-name strings at 100/101; they do not prove the validator is invoked or detects a defect.

**S350 · [packages/toolkit/ultramodern-create/tests/workspace-manifest.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-manifest.test.ts)**

Purge entire suite; retain any essential consumer behavior elsewhere

Added suite; disposition and scenario exceptions govern. This is a literal generated-file-tree freeze plus action/version pin snapshots. It requires test edits for legitimate additive files and upgrades while accepting broken contents. Remaining no-overwrite and Tailwind assertions duplicate stronger suites.

- S350.01 · T3 · [Exact reviewed action SHAs/mise release](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-manifest.test.ts#L197): Purge copied SHAs and2026.8.3 literal; this does not establish that a workflow runs or the commits were reviewed.
- S350.02 · T3 · [Checked-in entire workspace manifest](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-manifest.test.ts#L230): Purge exact baseline at 16 and vertical list119, createdPaths at 252/290 and disk lists279/348. Broken code with the same filenames passes.
- S350.03 · T3 · [No-Tailwind entire manifest equality](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-manifest.test.ts#L366): Purge; duplicates Tailwind config/dependency behavior and freezes every unrelated file.

**S352 · [packages/toolkit/ultramodern-create/tests/workspace-validation-contract.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-validation-contract.test.ts)**

Purge semantic-evidence label and policy key-set snapshot

Added suite; disposition and scenario exceptions govern. The test named semantic evidence never runs a compiler, runtime, behavior gate or validator. It merely deep-equals arrays of evidence labels and architecture policy objects.

- S352.01 · T3 · [Required semantic-evidence labels](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-validation-contract.test.ts#L10): Purge label list; compiler/runtime entries being named does not mean evidence exists or is checked.
- S352.02 · T3 · [Exact structural policy keys](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-validation-contract.test.ts#L25): Purge key-set and forbidden-path snapshots; behavior belongs in the actual architecture guard.
- S352.03 · T3 · [Composition policy keys and retired fields](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-create/tests/workspace-validation-contract.test.ts#L52): Purge exact object layout and old-property absence70/72.

**S357 · [packages/toolkit/ultramodern-sandpack-profile/tests/profile.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-sandpack-profile/tests/profile.test.ts)**

Purge entire file; use the existing build smoke as the survivor.

Added suite; disposition and scenario exceptions govern. Materializes the exported string map, reads it back, and tests exact versions/commands and source-token presence. The title says executable but nothing executes.

- S357.01 · T3 · [Executable single-app profile](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-sandpack-profile/tests/profile.test.ts#L33): Only JSON reads and exact version/script/npm-alias strings. Does not install packages or prove the aliases exist.
- S357.02 · T3 · [Capabilities in executable entrypoints](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/packages/toolkit/ultramodern-sandpack-profile/tests/profile.test.ts#L79): Ten regex assertions can all pass when every line in all five input source files is commented out. An in-memory probe confirmed all ten still pass; no repository file was changed.

**S366 · [scripts/__tests__/docs-truth.test.mjs](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/__tests__/docs-truth.test.mjs)**

PURGE entire suite

Added suite; disposition and scenario exceptions govern. Historical prose blacklist and directory-existence checks. It can pass fabricated evidence phrased differently and fail harmless discussion of a retracted claim. This is editorial cleanup encoded as permanent tests.

- S366.01 · T3 · [Phrase blacklist](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/__tests__/docs-truth.test.mjs#L53): Hardcodes 3 documents, 10 basenames and 8 phrases; checks includes(false), never whether evidence is authentic.
- S366.02 · T3 · [Empty directories count as live evidence](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/__tests__/docs-truth.test.mjs#L79): Only fs.existsSync/isDirectory; an empty directory satisfies the entire assertion.

**S372 · [scripts/__tests__/ultramodern-published-create-proof.test.mjs](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/__tests__/ultramodern-published-create-proof.test.mjs)**

purge_duplicate_suite

Added suite; disposition and scenario exceptions govern. A second handcrafted compact-cohort happy path; the owning readiness suite already exercises the same helper with compact observations and negative cases.

- S372.01 · T3 · [published create proof accepts compact UltraModern metadata](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/__tests__/ultramodern-published-create-proof.test.mjs#L14): Duplicates assertGeneratedCohort happy-path coverage in scripts/ultramodern-production-readiness/__tests__/published-create-proof.test.js:879. Consolidate any nested-workspace detail into that owner before deleting this standalone suite.

**S385 · [scripts/security/__tests__/workflow-toolchain-policy.test.mjs](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/security/__tests__/workflow-toolchain-policy.test.mjs)**

PURGE suite; keep generic policy in security validator and actual supported-runtime runs

Added suite; disposition and scenario exceptions govern. Four tests freeze exact third-party SHAs, versions, runner image and workflow step text. It already contradicts node-version-policy and fails against committed nightly configuration.

- S385.01 · T3 · [Exact action SHA and mise version duplication](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/security/__tests__/workflow-toolchain-policy.test.mjs#L78): Every legitimate action update requires synchronized test editing; security validator already checks full-SHA pinning.
- S385.02 · T3 · [Contradictory nightly pin requirement](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/security/__tests__/workflow-toolchain-policy.test.mjs#L107): Executed failure: expects nightly 26.x, actual 26.7.0. node-version-policy.test.mjs requires every root workflow pin equals 26.7.0.
- S385.03 · T3 · [Runner image restatement](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/security/__tests__/workflow-toolchain-policy.test.mjs#L133): Asserts runs-on string macos-26 without executing tests on that image.
- S385.04 · T3 · [Step-name/command snapshot](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/security/__tests__/workflow-toolchain-policy.test.mjs#L138): Finds named steps and deepEquals exact run strings; build prerequisites should be verified by running the selected suite, not freezing labels.

**S403 · [scripts/ultramodern-publish/__tests__/root-script-targets.test.js](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/ultramodern-publish/__tests__/root-script-targets.test.js)**

purge_or_move_to_lint

Added suite; disposition and scenario exceptions govern. Regex-scans package scripts and checks existsSync; an empty or directory stub passes. This is not executable CLI coverage.

- S403.01 · T3 · [root node script entrypoints exist](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/ultramodern-publish/__tests__/root-script-targets.test.js#L9): No import or process execution. Direct CLI boundary smoke catches both absent and broken targets; optional inventory lint is not a behavioral test.

**S410 · [tests/e2e/builder/cases/dev/dev.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/e2e/builder/cases/dev/dev.test.ts)**

Purge the rewritten HTTPS and tools.devServer pseudo-checks; retain useful dev update coverage.

Fork changes only; preserve inherited tests. Mixed file: two re-enabled upstream cases were rewritten into false-green checks. This tier targets those fork rewrites, not the inherited suite.

- S410.01 · T3 · [dev.https accepts broken HTTPS](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/e2e/builder/cases/dev/dev.test.ts#L153): The catch turns any error containing https/certificate/devcert/openssl/self-signed into success. Executing this actual case with dev() throwing "HTTPS is completely broken" passes.
- S410.02 · T3 · [tools.devServer does not require the hook to run](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/e2e/builder/cases/dev/dev.test.ts#L184): The only hook/reload checks are inside if(setupCalled && reloadFn); no hook runs means success. If it does run, page.reload() supplies the behavior the framework should provide. Actual case passes with hooks ignored.
- S410.03 · T1 · [default & hmr (default true)](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/e2e/builder/cases/dev/dev.test.ts#L9): Source/CSS edits must become visible and cleanup is finally-protected. Keep this behavior; if claiming HMR rather than generic reload, preserve a state sentinel.
- S410.04 · T1 · [custom-port HMR](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/e2e/builder/cases/dev/dev.test.ts#L101): Keep only if custom client port is a distinct contract; toBeGreaterThan(0) no longer verifies configured port was respected.

**S480 · [tests/integration/routes-tanstack-mf/test/remote-loader-reliability.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/routes-tanstack-mf/test/remote-loader-reliability.test.ts)**

Purge four fixture-loader unit tests; move any uncovered framework classification assertions to its owning package and delete this integration suite.

Mixed suite; preserve explicitly identified survivors. Imports ../mf-host/src/routes/mf/remoteLoaderCore, which implements its own retry, timeout and export validation. The tests certify a custom fixture helper, not the framework loader.

- S480.01 · T3 · [retry before success](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/routes-tanstack-mf/test/remote-loader-reliability.test.ts#L11): Injected async function and waitImpl exercise the loop authored in remoteLoaderCore.ts:111. Framework remote loading could be broken and this stays green.
- S480.02 · T3 · [timeout](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/routes-tanstack-mf/test/remote-loader-reliability.test.ts#L35): Never-resolving injected promise tests a local timer wrapper; does not invoke real loadRemote.
- S480.03 · T3 · [invalid component contract](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/routes-tanstack-mf/test/remote-loader-reliability.test.ts#L65): Checks the local fixture isComponentType predicate and locally subclassed error.
- S480.04 · T1 · [fallback classification](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/routes-tanstack-mf/test/remote-loader-reliability.test.ts#L79): This one helper delegates to actual framework classifyModuleFederationFallback; preserve only if no owning-package test already covers it.

**S512 · [tests/integration/ssr/tests/preload.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/ssr/tests/preload.test.ts)**

Purge both fork replacement cases and this now-empty-purpose suite.

Fork changes only; preserve inherited tests. The preload fixture does not exist in the audited tree. Both active cases pass on absence without building, launching or testing preload. The optional present-fixture branch merely checks a doctype, not preload behavior.

- S512.01 · T3 · [should handle preload fixture availability](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/ssr/tests/preload.test.ts#L28): Counts non-node_modules directory entries and expects zero; when package exists it redundantly rechecks the condition that chose the branch.
- S512.02 · T3 · [should serve preload fixture when present](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/ssr/tests/preload.test.ts#L42): Absent fixture means assert missing dist/route.json and return success; present fixture means 200+doctype. Neither tests preload.

**S514 · [tests/integration/ssr/tests/scriptLoading.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/ssr/tests/scriptLoading.test.ts)**

Purge the rewritten pseudo-case or replace it with observable async-script/init-data behavior.

Fork changes only; preserve inherited tests. Fork enables a formerly skipped case but only checks a global manifest exists and pins builder-runtime.js in script.src. It tests neither SSR init-data consumption nor async/defer loading behavior.

- S514.01 · T3 · [Name and oracle are unrelated](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/ssr/tests/scriptLoading.test.ts#L38): Any page with that internal global and asset path passes, even if initialization data or script scheduling is broken.

**S521 · [tests/integration/superapp-portfolio/tests/chaos-toggles.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/chaos-toggles.test.ts)**

Purge this fixture-chaos subsystem's certification; retain at most one real interceptRequest isolation regression in a small framework fixture.

Added suite; disposition and scenario exceptions govern. Four large cases loop a ten-row taxonomy through a fixture-owned interceptor. That interceptor manufactures expected error envelopes from the same taxonomy, bypassing actual failure causes. Most of the suite tests the test apparatus.

- S521.01 · T3 · [request-scoped taxonomy toggle](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/chaos-toggles.test.ts#L493): Real HTTP reaches fixture interceptRequest, but fixture api/effect/index.ts:242 constructs a Response from toggle.expectedHttpStatus and createSuperAppChaosFailureEnvelope. No downstream timeout occurs.
- S521.02 · T3 · [resettable retry storm](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/chaos-toggles.test.ts#L584): Repeats a static 429 response with attemptCount:8 read from fixture descriptor; no retries or real storm execute. Local loop assertion expect(attempt)>0 at 622 is tautological.
- S521.03 · T3 · [all failure modes and tenant-safe recovery](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/chaos-toggles.test.ts#L640): Expected status/error fields come from the same shared taxonomy used to generate the error. Fake auth expiry, slow stream, remote failure and malformed-json interception do not validate the owning mechanisms.
- S521.04 · T2 · [concurrent chaos and healthy load](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/chaos-toggles.test.ts#L769): Useful shape for request isolation, but all ten modes exercise the same Map lookup and synthetic response. Replace with one actual framework middleware isolation case if uncovered.

**S523 · [tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts)**

Purge the entire suite and its test-only cache/router harnesses; any desired invalidation/offline regression must use the actual router/query client or browser.

Added suite; disposition and scenario exceptions govern. The loudest false coverage in this inventory. It invents ContractCacheHarness and ContractRouterHarness inside the test and verifies their behavior. No TanStack Router or Query client is instantiated. Real HTTP calls to demo endpoints do not turn a hand-written Map into TanStack coverage.

- S523.01 · T3 · [ContractCacheHarness](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts#L150): Test implements its own cache, stale clock, snapshot/restore, optimistic events and invalidation arrays, then asserts those implementations.
- S523.02 · T3 · [ContractRouterHarness](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts#L365): Navigation just assigns currentRoute and returns a Map value; prefetch/invalidation pushes route IDs to local arrays. Framework router can be broken or absent and these checks still pass.
- S523.03 · T3 · [aborted client writes](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts#L815): AbortController.abort() is called before fetch. Tests native fetch refusing an already-aborted request; no server cancellation occurs.
- S523.04 · T3 · [rollback and offline replay](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts#L921): Calls local rollback explicitly; offlineQueue at 973 is a local array and online is a boolean flipped by the test. No offline framework integration exists here.
- S523.05 · T3 · [tenant cache isolation](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts#L1036): Calls the test's retainTenantAppDetails method to delete disallowed Map entries, then checks they disappeared. Not a framework security or cache isolation test.
- S523.06 · T3 · [pilot contract boundary](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/effect-tanstack-contract-behavior.test.ts#L1103): Plain HTTP demo pilot call with fixed eventCount=8; redundant with index and pilot-chaos, with no TanStack assertion.

**S525 · [tests/integration/superapp-portfolio/tests/nightly.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/nightly.test.ts)**

Purge; replace a nightly promise with a bounded real failure/recovery test only where an owning runtime contract requires it.

Added suite; disposition and scenario exceptions govern. Repeats ordinary demo HTTP operations 30 times. The supposed failure is immediately reset before a workload request, so recovery from any actual outage is never demonstrated. No leak, latency or resource budget is enforced.

- S525.01 · T3 · [failure/reset/idempotency cycles](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/nightly.test.ts#L66): POST sets failureMode string, next POST resets it; no operation runs while failure is active. Repeats in-memory approval/chat/dedupe counts, not a soak test.
- S525.02 · T3 · [nightly metrics success](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/nightly.test.ts#L147): unexpectedErrorCount merely counts exceptions from metrics.timed, which already rethrows them. Event-loop delay in portfolioMetrics.ts measures the test process and is never gated.
- S525.03 · T3 · [opt-in mode](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/nightly.test.ts#L18): Default-skipped; certification runner enables it for nightly. Metadata elsewhere claiming one-hour nightly coverage is not this 30-cycle test.

**S526 · [tests/integration/superapp-portfolio/tests/pilot-chaos.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/pilot-chaos.test.ts)**

Purge the synthetic pilot certification and its fixture-owned productionChecks machinery.

Added suite; disposition and scenario exceptions govern. Certifies fake module outcomes manufactured by the demo API. No remote failure, clock skew, process restart or request timeout is induced. Twenty duplicate requests test a synchronous in-memory Array.find path.

- S526.01 · T3 · [production scenario contracts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/pilot-chaos.test.ts#L191): Locks 8/6 module events and productionChecks length 13/12. api/effect/index.ts:528 constructs these checks by concatenating descriptive strings.
- S526.02 · T3 · [idempotency storm](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/pilot-chaos.test.ts#L239): Twenty real HTTP requests, but dedupe is fixture-owned in-memory pilotRuns.find; no distributed idempotency system or framework concurrency primitive under test.
- S526.03 · T3 · [remote/timeout/chunk/clock/restart chaos](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/pilot-chaos.test.ts#L265): Sends a chaos enum; api/effect/index.ts:470 computes degraded/ok booleans. Runtime mechanisms named by the test do not execute.
- S526.04 · T3 · [certification summary](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/pilot-chaos.test.ts#L348): Writes failedCount:0 as a literal after all assertions. Not independently measured certification evidence.

**S527 · [tests/integration/superapp-portfolio/tests/security.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/security.test.ts)**

Purge as framework security certification; preserve only any uncovered request-header transport/error-redaction check in bff-effect.

Added suite; disposition and scenario exceptions govern. It tests a fixture-authored security probe: Bearer prefix presence, x-user-role strings, a literal superapp-valid-csrf token, hard-coded origins and in-memory tenant tables. It does not exercise framework auth, CSRF, session or authorization mechanisms.

- S527.01 · T3 · [auth/role/CSRF/tenant/origin certification](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/security.test.ts#L146): Actual HTTP reaches createSecurityDecision in api/effect/index.ts:327, where every policy is custom fixture code. The framework could lack these protections entirely and this remains green.
- S527.02 · T3 · [security metadata](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/security.test.ts#L157): Asserts labels 'tenant isolation', 'csrf guard', 'telemetry redaction' and profile workflow strings. Labels do not establish security.
- S527.03 · T3 · [rejection outcome](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/security.test.ts#L88): Accepts any status>=400, including the fixture's intentional thrown-error 500, as successful authorization rejection. Valuable redaction concern is buried under a fake security contract.
- S527.04 · T3 · [failed count](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/security.test.ts#L311): Every successfully appended check is hardcoded ok:true; thrown failures never append a false check. afterEach can emit a zero-failure artifact on a failing run.

**S528 · [tests/integration/superapp-portfolio/tests/stress.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/stress.test.ts)**

Purge this nominal stress profile; keep one real integrated concurrency smoke with an explicit runtime invariant.

Added suite; disposition and scenario exceptions govern. Twelve cycles (six in release certification) of five concurrent demo state mutations and chat posts. No throughput, memory, event-loop, latency or concurrency-isolation budget is asserted.

- S528.01 · T3 · [cross-app workflow churn](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/stress.test.ts#L66): Five 'apps' are records handled by the same local fixture server; verifies only 200 statuses and demo event/message counts.
- S528.02 · T3 · [final event count](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/stress.test.ts#L139): Checks stressCycles*appIds.length and chat length; meaningful only for the fixture's synchronous counter logic, already repeated across portfolio cases.
- S528.03 · T3 · [metrics error count](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/superapp-portfolio/tests/stress.test.ts#L155): Zero recorded exceptions is redundant with metrics.timed rethrowing; measured durations and test-process event-loop delay have no pass/fail threshold.

**S529 · [tests/integration/tailwindcss/tests/tailwindcss-v2.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/tailwindcss/tests/tailwindcss-v2.test.ts)**

Purge only the added PostCSS contract source-reading case; retain inherited browser theme test.

Fork changes only; preserve inherited tests. Added test reads its own static fixture and freezes exact autoprefixer/postcss/Tailwind versions, config spelling and @tailwind lines. It cannot detect a broken build pipeline when those files stay unchanged.

- S529.01 · T3 · [Fixture self-portrait](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/tailwindcss/tests/tailwindcss-v2.test.ts#L10): Dependency updates or equivalent config syntax break it; a dead PostCSS implementation does not. Existing browser color test is the actual contract.

**S530 · [tests/integration/tailwindcss/tests/tailwindcss-v3.test.ts](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/tailwindcss/tests/tailwindcss-v3.test.ts)**

Purge only the added PostCSS contract source-reading case; retain the new macro computed-style assertion.

Fork changes only; preserve inherited tests. Same fixture self-inspection as v2, mixed with a useful addition to the existing browser test.

- S530.01 · T3 · [Fixture self-portrait](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/tailwindcss/tests/tailwindcss-v3.test.ts#L10): Hard-codes dependency versions, content key and CSS directives without invoking production behavior.
- S530.02 · T0 · [Tailwind macro has visible effect](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/tests/integration/tailwindcss/tests/tailwindcss-v3.test.ts#L43): Computed yellow background and 200x50 dimensions must match; this is actual pipeline behavior.
