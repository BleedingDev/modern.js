This domain review is subordinate to the parent inventory for final tier counts and scope. Case counts below are reviewer estimates, not an executed test census.

# Release/readiness test-value audit

Audited all 21 assigned added suites at `4092c606b0` in `/tmp/ultramodern-test-audit-20260910`, against the assigned `origin/main...HEAD` scope. None were excluded as inherited upstream tests. Read every suite and relevant browser/acceptance/Tractor implementation. **23,929 lines; 365 top-level test declarations.** Nested/table-loop subcases are not counted separately.

T0 = keep strong behavior; T1 = useful, trim; T2 = replace/consolidate proxies; T3 = purge ceremony/source policing. Detailed scenario tiers in `release-review.json` preserve the valuable minority in mixed suites. No repository files or tests were modified. No builds, installs, full suite or real release/browser acceptance was run during this audit.

## Broken browser algorithms still produce green tests

A read-only Node loader changed **three production callbacks** in `scripts/ultramodern-production-readiness/browser-smoke/browser-validate.mjs` to throw immediately:

- line 158: hydration identity probe installation;
- line 208: hydration identity probe reading;
- line 1175: localized-navigation document continuity installation.

Two selected tests in `browser-smoke.test.js` still passed:

- line 3653: “fails when hydration replaces server-rendered remote nodes”;
- line 3706: “proves native localized navigation updates the route, html language, and translated DOM”.

**Baseline: 2/2 pass, exit 0. Mutant: 2/2 pass, exit 0. This is a two-test demonstration, not a claim that the whole suite passed.** The loader checks each mutation has exactly one source match. Fake `evaluate(_callback, operation)` at 3092 never runs the callback; `waitForFunction` at 3171 also ignores its callback. Fake click at 3011 directly sets route/language/labels from fixture flags. These tests cannot detect those browser algorithms becoming wholly unusable.

Evidence/reproduction: `release-mutation-proof.loader.mjs`, `release-mutation-proof.py` and `release-mutation-proof.txt` under `/tmp/ultramodern-audit/`. Run `python3 -S /tmp/ultramodern-audit/release-mutation-proof.py`. Source changes exist only in the Node loader's memory; the demonstration leaves tracked source unchanged.

Replace the fake-browser scenario matrix and its roughly 350-line fake browser with a small actual browser fixture for essential browser behavior. Retain a few report-parser units and real process/port/artifact guards. The fake has some harness-unit value; it is not evidence that native navigation, hydration continuity or remote-process isolation works.

## Immediate purge/consolidation candidates

1. **A rejection test which never rejects.** `gen-cohort-change-record.test.js:445` renders 2,000 entries and only asserts their body exceeds the limit at 459. It never invokes the rejecting generator guard or asserts a throw. Replace with a real guard call or delete.
2. **Exact duplicate receipt test.** `acceptance-receipt.test.js:295` and `:331` both change `commits.changed` to `'4'.repeat(40)`, write the same JSON and expect the same error. The helper at 149 only performs that write. Delete one.
3. **Workflow spelling/runbook/inventory enforcement.** In `publish-security.test.js`, cut config pin 45, literal concurrency pin 833, descriptions/step strings/counts at 1001, exact 12-job inventory at 1304, command bans at 1331, directory-as-coverage logic 1515–1624, and runbook phrase policing 1723–1760. Retain semantic permissions/needs and evaluated scheduling. `sidecar-publish-lane.test.js:141/168/190/224` and `publish-outcome.test.js:32` repeat related source policing.
4. **Release/version tripwires.** `prepare-bleedingdev-packages.test.js:4177` reads live source version then asserts exactly 3.9.0, duplicating general policy at 214. `sidecar-publish.test.js:611` pins IPX 3.2.1 and literal compiled-source banner spelling. `published-create-proof.test.js:1386` requires two independently owned Playwright versions to differ. All reject legitimate updates without demonstrating correctness.
5. **Claims proved only by configured values.** `prepare-bleedingdev-packages.test.js:3367` says the registry tolerates transient failures but only deep-equals timeout/max_fails/fail_timeout. `browser-smoke.test.js:1835/1898` call outages “real” but use fake fetch flags/Map state and injected stop/start callbacks. Trim/rename the units and place behavior confidence in the actual flow.
6. **Tractor passed JSON as shopping proof.** `tractor-downstream.test.js:380/410/451` consume fabricated browser evidence; at 410 the injected runner writes its own passing artifact. Command/check-ID inventory at 698 repeats at 1410; seeder availability at 1799 checks functions/paths only. Keep environment, registry and real cleanup boundaries.
7. **Whole-file duplicates/existence checks.** Remove `root-script-targets.test.js`: an empty or directory stub satisfies existsSync. Consolidate `scripts/__tests__/ultramodern-published-create-proof.test.mjs` into readiness `published-create-proof.test.js:879`, which already checks compact observations and negatives. Transfer any unique nested-workspace fixture detail first.
8. **Fixture presentation constraints.** `browser-smoke.test.js:3771` rejects two Czech navigation links, prohibiting a valid header/footer pair. Exact ten-vertical lists/profile size, headless launch object, full env Object.keys sets, artifact filename inventories and precise install-command counts offer similarly weak protection.

These are ambitious cuts inside nine T2 suites, not wholesale deletion of all nine. The two whole-file T3 candidates are the cleanest first pass.

## Duplicate families

- **Receipt/projection fanout:** acceptance-contract, acceptance-receipt, operational-independence, published-create-proof, Tractor, publish-outcome and publish-security reconstruct overlapping passing reports, then mutate missing/status/digest/source fields. Keep detailed invariants in their owning validator and one producer-to-consumer boundary rejection per integration.
- **Runtime env/Playwright provisioning:** published-create-proof and Tractor repeatedly deep-equal shared-owner values and commands. Keep owner tests plus actual poisoned-child-env boundaries. Independent browser package owners may choose the same version.
- **Source cleanliness:** release-source-state owns real git behavior. Build/prepare wrappers need one rejection/no-side-effect assertion each.
- **Workflow qualification:** publish-security, sidecar lane and publish outcome overlap path/command/permission checks. Keep one semantic schedule/authority model and actual CLI boundaries. A test directory existing does not prove imported behavior is covered.
- **Asset duplicate checks:** browser-smoke 4093/4144/4186 repeat one mechanism across distinct pre-hydration/no-JS/post-hydration phases. Parameterize while preserving the phases. Similarly combine missing-asset variants without erasing content-kind differences.
- **Compact cohort metadata:** the standalone root suite duplicates readiness's helper happy path.

## Preserve the real boundaries

- `prepare-bleedingdev-packages.test.js:2719`: installed libnpmpublish sends accepted bytes to a real loopback HTTP server. Verifies bytes, tag, auth and no request on provenance failure.
- Actual npm-packed tarball mutation checks at prepare 1278/1320/4653 and sidecar lane 720/1518; real deployed-file/root/symlink checks in browser-smoke/operational-independence.
- Whole-cohort authorization before first mutation (prepare 4366/4459), dry-run credential/publication exclusion (3033), existing-version uncertainty refusal (4819), bounded retry versus terminal registry-state behavior.
- Real child signal cleanup, scratch-git source state, server/port bootstrap and poisoned-child-env regressions.
- Backfill evidence failure prevents release mutation; archive traversal rejection; artifact pagination/cross-attempt binding.
- Small type-path guard, recognizing it does not compile a TypeScript consumer.

The 4,942-line prepare suite has more actual publish-boundary behavior than the 4,229-line browser-smoke suite. Keep its byte/side-effect boundaries; trim repeated three-package packing for pure policy units and incidental snapshots.

## Infrastructure and interpretation traps

- **Real acceptance implementation exists.** `published-create-proof/acceptance-profile.mjs:933` onward invokes native generation, install/check/build, Node browser proof before Cloudflare replaces .output, then workerd browser proof. Its unit tests frequently inject those operations. This audit does not claim the production acceptance flow is entirely fake.
- **Real Tractor downstream path exists.** `tractor-downstream/main.mjs:712` invokes downstream `scripts/proof-public-workflow.mjs`; the flow at 820 onward runs it after Node/workerd startup. Fabricated unit artifacts cannot substitute for this evidence.
- **Cryptography is mocked in these prepare cases.** `acceptSigstoreBundle` accepts fake signatures; 1718 checks options/delegation into fake verify. Useful policy coverage, not actual signature verification.
- **History coupling:** gen-change-record CLI depends on latest tag/queued changesets. Publish-outcome reads current git/archive state and an explicit old release tag. Backfill repeatedly archives scripts. Isolate normal fixtures; keep historical-validator compatibility in a deliberately owned lane if still supported.
- **Real sleeps/fixed timing:** prepare 3995 fixes 36 attempts/>=350s schedule, actually waits, and requires elapsed <10s. Use a controllable waiter while preserving state behavior. Keep small concurrency tests.
- **Temporary fixture leakage:** several sidecar makeTempDir usages copy/pack files without final cleanup. Fake remove/process tests do not replace actual cleanup regressions.
- **Silent green:** sidecar-publish 576 returns success if any expected repository root is missing.
- These are Node `node:test` suites. Declaration totals are not expanded run counts. The main audit owns global discovery analysis.

## Minimal useful release acceptance

1. **Exact packed consumer:** pack intended cohort/sidecars once, install through loopback registry in a clean consumer, run the actual generator and representative generated check/build. Resolve aliases/public entries in CJS/ESM, exercise a CLI, and compile a representative public type consumer.
2. **Actual Node/workerd browser behavior:** serve final deployments, verify content with JS disabled, enable JS and verify hydration continuity, click native localized navigation, observe translated UI/API data, and actually stop/restart a remote to measure isolation/recovery. This must kill the three-callback mutant.
3. **Real Tractor adoption:** preserve visible search/product/cart workflow on exact release through downstream proof process and native router primitives. Generated profile and persistent downstream are distinct consumer contexts; trim arbitrary inventories rather than replacing one with the other.
4. **Publisher boundary/recovery:** real installed-publisher-to-loopback test, accepted-byte tamper rejection, no credentials/mutation in dry-run, whole-cohort preflight, and partial-publication/retry terminal-state logic.
5. **Evidence interoperability:** one producer-to-consumer receipt roundtrip plus wrong-source/wrong-attempt/tampered-byte negatives. Detailed schema validation belongs at its owner.

## Per-suite disposition

| Suite | Tier | Top-level cases | Action |
| --- | --- | ---: | --- |
| root/ultramodern-published-create-proof.test.mjs | T3 | 1 | purge duplicate suite |
| readiness/acceptance-contract.test.js | T2 | 20 | replace and trim |
| readiness/acceptance-profile-cleanup.test.js | T0 | 2 | keep |
| readiness/acceptance-receipt.test.js | T2 | 7 | consolidate to boundary roundtrip |
| readiness/browser-smoke.test.js | T2 | 72 | replace fake browser scenarios preserve harness boundaries |
| readiness/operational-independence.test.js | T1 | 24 | keep byte boundaries trim projections |
| readiness/published-create-proof.test.js | T2 | 17 | trim snapshots consolidate runtime owner |
| readiness/tractor-downstream.test.js | T2 | 18 | replace report fixtures with downstream boundary |
| publish/backfill-change-record.test.mjs | T1 | 12 | keep mutation guards trim delegation |
| publish/build-bleedingdev-packages.test.js | T2 | 3 | consolidate cli boundary |
| publish/gen-cohort-change-record.test.js | T1 | 12 | keep history behavior delete false test |
| publish/prepare-bleedingdev-packages.test.js | T1 | 84 | keep real publish boundaries trim ceremony |
| publish/publish-outcome.test.js | T2 | 9 | consolidate receipt schema fanout |
| publish/publish-security.test.js | T2 | 17 | purge source ceremony keep semantic authority checks |
| publish/release-source-state.test.js | T0 | 4 | keep |
| publish/root-script-targets.test.js | T3 | 1 | purge or move to lint |
| publish/sidecar-publish-lane.test.js | T1 | 33 | keep registry byte boundaries purge source snapshots |
| publish/sidecar-publish.test.js | T1 | 16 | keep staging alias behavior trim repository pins |
| publish/source-create-proof-entrypoint.test.js | T2 | 4 | consolidate entrypoint behavior |
| publish/source-qualification.test.js | T1 | 7 | keep identity boundary trim schema projection |
| publish/types.test.js | T1 | 2 | keep small filesystem guard |

Detailed line-level evidence and confidence: `release-review.json`.
