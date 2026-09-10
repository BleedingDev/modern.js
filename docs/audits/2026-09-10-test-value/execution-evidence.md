The following checks support particular audit findings. They are not a certification of the complete test fleet or application.

| Check | Observed result | What it establishes |
|---|---|---|
| Governance/helper/security selection | 146 reported tests: 144 pass, one committed pin mismatch, one missing parser dependency in the isolated checkout | The exact pin assertion is already stale. The parser dependency is installed by the real security workflow, so its local absence is not a CI defect. |
| Import/divergence suites | 67 reported tests: 65 pass, two live-repository policy failures, about 163 seconds | Fixture-based bypass/ownership/cap tests passed. The live fork gate is red; that is not justification to delete enforcement. |
| Focused docs/toolchain confirmation | 6 reported tests: 5 pass, nightly `26.x` expectation fails against `26.7.0` | Overlaps the first selection; do not add it to a unique-test total. |
| Recovery no-op probe | Both unchanged child-fixture scenarios satisfy every captured scenario oracle | Those assertions do not require the UltraModern recovery plugin. This was not an entire monorepo suite run. |
| Browser callback mutation | Baseline 2/2 and mutant 2/2 pass with three production callbacks changed to throw | Two focused fake-browser tests cannot detect failures in the named hydration/navigation algorithms. |
| Builder dev test-body probe | Broken-HTTPS error and never-invoked hooks both pass the actual test bodies | Isolated dependency stubs demonstrate permissive oracles; no dev server/application was built. |
| SSR control-guard probe | Hidden-mode oracle survives deleted SSR guard; visible-mode control detects it | The chosen hidden configuration makes the current SSR test vacuous. |
| Sandpack assertion replay | All ten exact capability regexes pass against commented-out capability source | This is an assertion replay, not a run of the entire profile suite. |
| Governance source/metadata probes | Commented `--run-identity` accepted; blank duplicate reviewer keys accepted | Source token presence and reviewer-line counts do not establish the claimed authority. |
| Release metadata/skip probe | Stale/non-commit/duplicate metadata accepted; nine commands skipped with exit 0 and `passed:false` | Shape validation is not executed release qualification. Local run explicitly used CI=false for the checked-in legacy evidence; the independent fake metadata probe enabled CI-backed validation. |

The boundary run observed 18 new import violations, with 23 current versus 9 allowlisted, and 791 divergence violations. It measured 1,276 files, 3,532 hunks and 168,696 changed lines against the recorded 613-file/34,329-line budgets. These are outcomes at the pinned audit snapshot, not new budgets or a proposal to waive policy. Remove redundant live-tree unit assertions or frozen totals if approved, while preserving the canonical enforcement command and its adversarial fixture tests.

Raw probe output and the exact probe sources are archived under [evidence](evidence/). Executable sources have an additional `.txt` suffix so they do not become a new test suite. Their local paths and dependency locations record the audit environment; adapt those paths to reproduce on another checkout. The SSR probe records Node v26.8.1 and the installed Module Federation runtime 2.9.0. No live repository implementation was edited for these mutations.

The genuine acceptance implementations, real browser matrices, packed-consumer builds and Tractor downstream application were reviewed but not executed by this audit. Expensive monorepo installation/build was intentionally unnecessary for a recommendation-only change. Selected native dependencies already present in the original workspace were used for the bounded probes. No tests were deleted, no production state was published, and no receipt above claims otherwise.

TraceDecay provided semantic navigation and duplicate candidates. The initial context call reported 45,198 tokens avoided; stale-index warnings were handled by reading the pinned files. Similarity was treated as a lead, not proof of redundant behavior. Final ratings rely on the actual assertion, production/helper context and the evidence described here.
