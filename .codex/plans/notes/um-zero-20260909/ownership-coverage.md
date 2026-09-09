# Initial debt and import ownership coverage

Frozen planning source: `114047c57d4eb8f4f8954ecb9dc1b90a0296d608`; accepted code: `7871954269a9d3e8f95a372b02fc5f2e2f965179`.

Every recorded violation and current import edge has one initial lane. Refresh the exact rows at execution start; do not mistake a reservation for a proven implementation disposition.

| Lane | Divergence files | Current import edges |
| --- | ---: | ---: |
| bff | 72 | 1 |
| build | 69 | 1 |
| docs-ownership | 47 | 0 |
| localization | 46 | 6 |
| packaging | 30 | 0 |
| runtime-router | 62 | 2 |
| runtime-ssr | 33 | 5 |
| server | 40 | 5 |
| toolkit | 41 | 1 |

The target is zero current edges, including five active allowlisted edges. Four other allowances are already stale and must be removed only through the normal reviewed imports policy path. Normal imports outside the governed boundary are not a target for deletion.

## Exact current edges

| Source | Specifier | Allowlisted | Owner |
| --- | --- | --- | --- |
| `packages/cli/plugin-bff/src/runtime/create-request/index.ts` | `@modern-js/create-request` | yes | bff |
| `packages/runtime/plugin-i18n/src/cli/index.ts` | `@modern-js/i18n-runtime-extensions` | no | localization |
| `packages/runtime/plugin-i18n/src/runtime/context.tsx` | `@modern-js/i18n-runtime-extensions` | no | localization |
| `packages/runtime/plugin-i18n/src/runtime/hooks.ts` | `@modern-js/i18n-runtime-extensions` | no | localization |
| `packages/runtime/plugin-i18n/src/runtime/utils.ts` | `@modern-js/i18n-runtime-extensions` | no | localization |
| `packages/runtime/plugin-i18n/src/server/index.ts` | `@modern-js/i18n-runtime-extensions` | no | localization |
| `packages/runtime/plugin-i18n/src/shared/type.ts` | `@modern-js/i18n-runtime-extensions` | no | localization |
| `packages/runtime/plugin-runtime/src/core/server/stream/createReadableStream.ts` | `@modern-js/runtime-extensions/node` | no | runtime-ssr |
| `packages/runtime/plugin-runtime/src/core/server/stream/createReadableStream.worker.ts` | `@modern-js/runtime-extensions` | no | runtime-ssr |
| `packages/runtime/plugin-runtime/src/core/server/string/index.ts` | `@modern-js/runtime-extensions` | no | runtime-ssr |
| `packages/runtime/plugin-runtime/src/core/server/utils.ts` | `@modern-js/runtime-extensions` | no | runtime-ssr |
| `packages/runtime/plugin-runtime/src/exports/head.ts` | `@modern-js/runtime-extensions` | no | runtime-router |
| `packages/runtime/plugin-runtime/src/router/runtime/PrefetchLink.tsx` | `@modern-js/runtime-extensions` | no | runtime-router |
| `packages/runtime/render/src/rsc-html-stream/server.ts` | `@modern-js/runtime-extensions/rsc-html-stream` | no | runtime-ssr |
| `packages/server/core/src/utils/error.ts` | `@modern-js/runtime-extensions/safe-failure` | no | server |
| `packages/server/prod-server/src/apply.ts` | `@modern-js/server-runtime-extensions` | yes | server |
| `packages/server/prod-server/src/index.ts` | `@modern-js/server-runtime-extensions` | yes | server |
| `packages/server/prod-server/src/index.ts` | `@modern-js/server-runtime-extensions/runtime-lifecycle` | no | server |
| `packages/server/server/src/createDevServer.ts` | `@modern-js/server-runtime-extensions/runtime-lifecycle` | no | server |
| `packages/solutions/app-tools/src/index.ts` | `./presetUltramodern` | yes | build |
| `packages/toolkit/utils/src/universal/index.ts` | `./backend-federation-contract` | yes | toolkit |

## Per-file review requirements

For each JSON inventory row record immutable identity, introduced-by commit, actual purpose, callers and exports, destination package, exact supported seam or upstream PR, complete PR added+removed count, cumulative hunk/line delta, ledger disposition, affected tests, and final proof. Unknown routes stay blocked. Include generated metadata, tests and docs; no ownership exclusions based on file type.
