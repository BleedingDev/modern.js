Infrastructure verdicts use the same tiers as the test inventory. These are review recommendations; no infrastructure was removed.

**I01 · T2 · [.github/workflows/contract-gates.yml:126](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/.github/workflows/contract-gates.yml#L126)**

Replace the pull-request metadata gate with a small executed contract check; distinguish validation-only from qualification in the job result.

Pull requests default to run_commands=false and pass --skip-commands. The CLI correctly records qualified=false but exits zero. The summary then says required jobs succeeded. This green check supplies no evidence that any of the nine release commands ran.

Evidence: scripts/release-gates/validate-release-candidate-gates.js:129,149,167; scratch execution skipped all nine commands, exited 0 and wrote passed:false. This is a misleading CI signal, not a false passed:true receipt.

**I02 · T3 · [scripts/release-gates/rc-contract-profile.json:30](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/release-gates/rc-contract-profile.json#L30)**

Remove --passWithNoTests from explicit required test selections.

The builder, BFF and app-tools release selections explicitly accept finding no tests. A required named regression disappearing should fail selection, not qualify the command.

Evidence: The same flag occurs at lines 31,43,64. Static command review; the complete release matrix was not executed.

**I03 · T3 · [scripts/release-gates/validator/evidence.js:6](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/release-gates/validator/evidence.js#L6)**

Retire prose evidence and reviewer-count checks as release qualification. Keep only real run/artifact binding where release consumers require it.

Reviewers are counted by matching reviewer-key lines. Metadata validation checks nonempty text and URL shape, not reviewer independence, actual execution, commit identity or freshness. Checked-in current evidence dates to April/May.

Evidence: A scratch document with a year-2000 timestamp, non-commit commit_sha, duplicate same-person reviewers and a syntactic actions/runs/1 URL passed requireCiBackedMetadata:true. No actual GitHub run was queried or claimed.

**I04 · T3 · [.github/workflows/bun-superapp-smoke.yml:58](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/.github/workflows/bun-superapp-smoke.yml#L58)**

Delete this as SuperApp runtime evidence. Retain a tiny explicit validator-under-Bun compatibility check only if that support matters.

The command runs a dependency-free release metadata validator with --skip-commands. It never starts, builds, renders or hydrates an UltraModern application.

Evidence: package.json validate:bun-smoke and the workflow comment explicitly describe its limited validator purpose. The issue is paying for and interpreting it as a SuperApp smoke lane.

**I05 · T2 · [scripts/superapp-certification/run-superapp-certification.js:90](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/superapp-certification/run-superapp-certification.js#L90)**

Collapse certification around a real generated-app acceptance command; remove portfolio matrix orchestration with the toy scenarios it runs.

Smoke/release/nightly wrap the portfolio security, stress, pilot-chaos and browser matrix suites. Many underlying scenarios exercise hand-written demo booleans, classes and scenario strings. More profiles and generated reports do not strengthen those oracles.

Evidence: Nightly includes release, then runs the browser matrix a second time with wider browser flags at 190. Review the integration findings before retaining any portfolio-dependent lane.

**I06 · T2 · [scripts/superapp-certification/run-superapp-certification.js:267](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/superapp-certification/run-superapp-certification.js#L267)**

Rename upstream drift as merge-conflict detection; keep it as a lightweight maintenance aid only.

The drift routine fetches, creates a worktree and merges. A successful merge returns merged immediately. It does not build or run tests against the merged source.

Evidence: Lines 319-345; commandResults remains empty for this lane. Clean textual merge is not upstream runtime compatibility.

**I07 · T1 · [rstest.config.mts:4](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/rstest.config.mts#L4)**

Keep ordinary package discovery; explicitly connect useful standalone build checks and remove static substitutes.

Root unit discovery searches packages/**/rstest.config only. scripts/rslib has its own real build suite outside that search. Sandpack's meaningful profile-build.smoke.ts requires test:build-smoke; its default test command selects the weak source-text suite.

Evidence: No tracked standard workflow selection was found for the Rslib source-entry suite or Sandpack build-smoke command. This is a source-based wiring audit, not proof they have never been run manually.

**I08 · T1 · [scripts/rstest-config/src/index.ts:13](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/scripts/rstest-config/src/index.ts#L13)**

Keep fast source tests and one genuine packed-consumer proof for important public packages; remove duplicate export-string checks.

The preset intentionally resolves modern:source first. Passing these unit suites cannot alone establish that published exports, declarations and dependency closure work. Native subprocess/packed consumer tests provide distinct value.

Evidence: The source-resolution condition is explicit at line 15. Several reviewed suites bypass it correctly; preserve those survivors rather than requiring every unit case to repeat across formats.

**I09 · T2 · [.github/workflows/ultramodern-nightly.yml:51](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/.github/workflows/ultramodern-nightly.yml#L51)**

Separate dependency-free script tests from the few built-package acceptance tests, then remove duplicate portfolio jobs.

The script job builds the monorepo before node:test because some selected suites import built output. The certification job separately installs and builds again. This is a large execution cost attached to many pure validators and mocked browser tests.

Evidence: First build at lines 53-57 and second at 99-109. No measured runtime saving is claimed; cost reduction depends on which suites the owner deletes.

**I10 · T0 · [.github/workflows/ultramodern-tractor-downstream.yml:184](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/.github/workflows/ultramodern-tractor-downstream.yml#L184)**

Keep exact-cohort Tractor acceptance and preserve the visible Tractor UI.

This is the user's explicit downstream acceptance requirement and exercises the actual consumer through the shared acceptance implementation. Remove redundant shape checks around it only after preserving real Node/workerd, navigation, SSR and failure evidence.

Evidence: The workflow passes the exact release manifest to run-tractor-downstream-acceptance.mjs. This audit did not run or claim downstream acceptance; no generator/runtime/tooling behavior was changed.

**I11 · T0 · [.github/workflows/boundary-anti-patterns.yml:63](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/.github/workflows/boundary-anti-patterns.yml#L63)**

Keep canonical import/divergence enforcement; purge exact live repository-total assertions in its test suite.

Canonical scope, ownership, ledger provenance and the <=20-line upstream patch cap are explicit repository policy. Executing the gate on real PR ranges and adversarial git fixtures is useful. Hardcoding today's totals adds a second maintenance obligation without a stronger policy guarantee.

Evidence: The workflow invokes import and divergence modes, including the PR/push ranges. Preserve fixture tests proving bypasses fail closed.

**I12 · T1 · [.github/workflows/workflow-security.yml:62](https://github.com/BleedingDev/ultramodern.js/blob/4092c606b0704f2e7119c4a16d1d9ef149d28034/.github/workflows/workflow-security.yml#L62)**

Keep the executable security validator lane; remove exact SHA/version/step-name restatements and replace comment-sensitive source checks.

Security tests are selected here even though test:scripts omits them. They are not orphaned. A committed toolchain policy assertion already contradicts nightly configuration; another authentication check can be satisfied by a shell comment containing --run-identity.

Evidence: The workflow installs the required parser before its tests. Missing parser dependencies in the isolated audit checkout are an environment limitation, not a CI defect. See governance execution and mutation evidence.
