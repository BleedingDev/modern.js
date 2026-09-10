This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# Governance, security, and skill test-value audit

Audited all 24 assigned suite files at clean commit `4092c606b0704f2e7119c4a16d1d9ef149d28034`, against `origin/main...HEAD`. The inventory contains approximately 228 newly added registrations/scenarios, excluding wrapper double-counting and inherited skill scenarios. Parameterized loops mean registration counts and assertions are different quantities.

The clearest purge candidates are the entire documentation-truth suite and the entire workflow-toolchain-policy suite. Remove the hardcoded divergence totals, duplicated native-helper checks, and the three new migration-fixture pin/import checks too. Several purported security checks deserve replacement: a shell comment currently satisfies the test's “authenticated run identity” obligation.

The fixed audited base, canonical scope, and 20-line patch cap are explicit user requirements. Executing a validator against 20-line and 22-line Git patches is useful. Freezing the current repository at 613 files and 34,329 changed lines is maintenance ceremony.

## Per-suite decisions

Detailed line references, reasons, scope exclusions and mixed-case tiers are in `governance-review.json`.

| Suite | Tier | Decision |
| --- | --- | --- |
| `scripts/__tests__/docs-truth.test.mjs` | T3 | Purge both cases and the file. |
| `scripts/__tests__/node-version-policy.test.mjs` | T1 | Keep child-process runtime rejection; remove manifest/workflow pin repetition. |
| `scripts/__tests__/public-declarations.test.mjs` | T0 | Keep discovery adapter; zero independent cases. |
| `scripts/__tests__/strict-effect-cli.test.mjs` | T0 | Keep discovery adapter; actual CLI cases live elsewhere. |
| `scripts/__tests__/tsgo-critical.test.mjs` | T2 | Replace existence/path assertions with a real compiler invocation in the retained compiler proof. |
| `scripts/__tests__/tsgo-invocation.test.mjs` | T0 | Keep bin-shape table and literal-argv subprocess test. |
| `scripts/boundary-guards/__tests__/validator.test.js` | T1 | Keep forbidden import/re-export outcomes; consolidate parser and schema happy paths. |
| `scripts/lib/__tests__/cli-kit.test.js` | T1 | Keep distinct argument semantics; remove exact error-prose obligations. |
| `scripts/lib/__tests__/fs-kit.test.js` | T2 | Consolidate into one real filesystem contract; remove native JSON/path restatements. |
| `scripts/lib/__tests__/process-kit.test.js` | T0 | Keep subprocess, environment scrubbing and fail-fast behavior. |
| `scripts/lib/__tests__/validation-kit.test.js` | T2 | Purge duplicate JSON/path/prose checks; move necessary guard boundaries into retained validator cases. |
| `scripts/lib/__tests__/validator-clis.test.js` | T1 | Keep skipped/missing/real-command qualification tests; trim empty-profile and duplicate shape checks. |
| `scripts/prebundle/ultramodern/public-declarations.test.mjs` | T1 | Keep actual strict consumer compilation and invalid-API rejection; remove historical diagnostic inventory. |
| `scripts/release-gates/__tests__/external-surface.test.js` | T1 | Keep compact classifier fixtures; do not call declared metadata actual runtime compatibility. |
| `scripts/release-gates/__tests__/validator.test.js` | T1 | Keep command failure and snapshot merge; replace weak reviewer/provenance evidence case. |
| `scripts/rslib/tests/source-entry.test.ts` | T0 | Keep build/watch/rejection behavior and wire it into tracked discovery. |
| `scripts/security/__tests__/github-job-condition.test.mjs` | T1 | Keep scheduling outcomes; trim AST-shape assertions. It tests our restricted evaluator. |
| `scripts/security/__tests__/validate-github-workflows.test.mjs` | T1 | Keep malicious YAML fixtures; replace receipt-token theater and trim fixed topology restatement. |
| `scripts/security/__tests__/workflow-toolchain-policy.test.mjs` | T3 | Purge all four cases and the file. Already stale and contradictory. |
| `scripts/superapp-certification/__tests__/generate-readiness-report.test.js` | T0 | Keep both warning/skipped propagation tests. |
| `scripts/ultramodern-boundary-check/__tests__/checker.test.js` | T1 | Keep Git fixture behavior; remove redundant full-tree execution if the actual gate remains. |
| `scripts/ultramodern-boundary-check/__tests__/divergence.test.js` | T1 | Keep adversarial policy tests; purge totals/workflow regex/self-test count; merge duplicate ownership setup. |
| `tests/skill/feature-enable.mjs` | Excluded | Scenario families inherited. Added VM harness reviewed separately; no new standalone scenarios. |
| `tests/skill/run.mjs` | T2 | Purge three added fixture-policing assertions; constrain the new permissive harness. Inherited cases excluded. |

## Concrete failures and false evidence

1. **A comment satisfies “authenticated run identity.”** `validate-github-workflows.test.mjs` tests a missing `--run-identity` token and then adds it to the command. Actual `collectReceiptRunIdentityErrors()` at [scripts/security/validate-github-workflows.mjs:238](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/security/validate-github-workflows.mjs#L238) only uses string inclusion. An invocation with no identity argument fails validation. Appending `# --run-identity does-not-run` to its shell block makes validation return `[]`. The test creates false confidence about authentication. Reproduction and exact output: `governance-mutation-proof.mjs` and `governance-mutation-proof.json`.

2. **The toolchain tests contradict each other.** `workflow-toolchain-policy.test.mjs:107` expects nightly Node `26.x`; the committed workflow uses `26.7.0`. The other policy test requires every explicit root-workflow Node version to equal `26.7.0`. Executing the toolchain case fails. This is precisely the cost of duplicating configuration in tests.

3. **Reviewer evidence is counted as text.** The release validator's reviewer happy path has no rejection case for missing or duplicate identities. [scripts/release-gates/validator/evidence.js:6](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/release-gates/validator/evidence.js#L6) counts reviewer-key lines. Confirmed `minimumReviewers: 2` accepts two blank duplicate `reviewer_1:` lines, including with `requireCiBackedMetadata: true`. The existing test proves formatting acceptance, not review. The parent audit independently checked broader release evidence provenance; avoid duplicating that finding as a separate security defect.

4. **The actual boundary gates are currently red.** The clean audited checkout's live import test reports 18 added violations. Live divergence reports 1,276 measured files, 3,532 hunks and 168,696 lines against 613 files/34,329 lines allowed, producing 791 violations. Its `report.ok` assertion fails before reaching the frozen-count assertions. Deleting the unit test's duplicate live scan must preserve the real policy gate; these failures must not disappear by redefining valid behavior.

5. **Rslib's genuinely useful suite lacks tracked standard discovery.** Root `rstest.config.mts` selects only `packages/**/rstest.config.{ts,mts}`. `test:scripts` omits `scripts/rslib/tests/*.ts`. `scripts/rslib/package.json` has no test script; no tracked Rstest config or workflow invocation was found for the suite. It can be run manually, but its build/watch/rejection assertions are absent from the inspected normal test entry points.

6. **The new skill harnesses are simulated module environments.** Feature-enable mocks React effects/state and directly supplies the generated API implementation for `@api/*`; it never exercises generated client transport or a React rerender. Migration's `genericModule` manufactures arbitrary external exports through a Proxy. A passing test can coexist with nonexistent real modules/exports. Some fork rewrites also replaced exact no-write assertions with `JSON.stringify` of evaluated configuration, which ignores comments and function bodies. Source preservation is a valid codemod contract; the rewrite weakens it. These are harness limitations, not reasons to charge inherited scenario families against this fork.

## Duplicate families and deletion order

- **Immediate purge:** all documentation phrase blacklist/directory-existence cases; all toolchain exact SHA/version/image/step-string cases; divergence `results.length >= 8`; hardcoded live debt totals; the three added migration fixture Hono/Node/import checks.
- **One helper test per actual behavior:** `validation-kit` re-exports `fs-kit.readJsonFile`, and both suites test the same valid and malformed JSON cases. `repoRoot` and `resolvePath` assertions repeat implementation expressions. Remove them. Keep custom error context once, if still useful.
- **Stop pinning prose:** CLI unknown-argument wording and standard schema error sentences create pointless review churn. Rejection behavior and actionable fields suffice.
- **One canonical boundary gate:** full repository import/divergence scans are already executable validators. Run them as gates; keep deterministic fixtures as the regression suite. Delete duplicated production-tree scans only once the retained entry point is confirmed.
- **Reduce repeated ownership setup:** divergence's post-provenance upstream addition and generic upstream-source addition are the same failure family. Server/i18n/app-tools/BFF allowed-root cases can use a shared scenario table. Preserve rename/copy/bracketed identities, which exercise different Git ownership failures.
- **Separate historical defects from current contracts:** public declarations should keep the real strict compile and invalid consumer proof. The requirement to reproduce five exact old compiler diagnostics can go. Legacy divergence schema-migration compatibility can go when production no longer accepts that schema.

## Minimal survivor set

Retain one executable test for each meaningful boundary: unsupported Node binaries; shell-free compiler argv and public compiler execution; strict public declarations with accepted/rejected consumers; Rslib build/watch/failure; child-process environment scrubbing and failure propagation; allowed/forbidden imports; canonical Git scope/ownership/cap/ledger/writer behavior; adversarial workflow security fixtures; actual gate-command failure/nonqualification; warning/skipped readiness propagation. Keep external-surface fixtures only as declared-contract comparison tests.

The 20-line cap boundary, unresolved refs, scope narrowing, false ledger authorization, committed-head/worktree distinction, genuine shrink exception and writer rollback tests should survive. They are validating explicit policy with real invalid/valid inputs. Exact dependency versions, document phrases, workflow step labels and the current debt inventory should not.

## Validation performed

- Selected cheap Node suites: **146 reported tests, 144 passed, 2 failed, 0 skipped**. One failure is the real contradictory nightly version assertion. The other is `github-job-condition` loading: the isolated checkout has no installed `scripts/prebundle` `js-yaml`. Its dedicated `workflow-security.yml` job explicitly installs that parser, so this is an environment limitation. Security tests are selected separately by that workflow, although absent from `test:scripts`.
- Boundary suites: **67 tests, 65 passed, 2 failed, 0 skipped**, **163.1 seconds**. All fixture cases passed; the two actual repository policy checks failed as above. Ambient Git hooks emitted missing-lefthook messages; they did not prevent fixture cases from passing.
- Ran two scratch counterexamples for receipt-token comment acceptance and blank duplicate reviewer acceptance. No repository files changed. Final `git status --short` was empty.
- Built-declaration, strict Oxlint and Rslib suites were inspected statically; no build/install was launched for this audit. The skill suites were compared to upstream and read; they were not run because they invoke compilation and installation paths.
- TraceDecay search narrowed tracked test entry-point references; reported token savings were approximately **2,246 tokens** for that search. Findings were checked against files at the audited commit where the index was stale.
