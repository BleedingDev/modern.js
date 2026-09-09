---
'@modern-js/app-tools': patch
'@modern-js/bff-effect': patch
'@modern-js/builder': patch
'@modern-js/plugin-bff': patch
'@modern-js/plugin-i18n': patch
'@modern-js/plugin-tanstack': patch
'@modern-js/runtime': patch
'@modern-js/server': patch
'@modern-js/ultramodern-create': patch
'@modern-js/utils': patch
---

Advance the UltraModern.js dependency cohort to the newest matured releases.
Effect stays on `4.0.0-rc.112` (the current release candidate); the compiler
lane moves to `@effect/tsgo@0.41.0`, the build lane to Rsbuild 2.2.3, SWC
1.16.2, `@swc/plugin-loadable-components@13`, cssnano 9 and Babel 8.0.4, and
the runtime cohort to TanStack Router 1.170.33 / router-core 1.171.28 /
history 1.162.2, i18next 26.4.2, react-i18next 17.0.13, Hono 4.13.7, Zod
4.5.4, msgpackr 2.1.0 and OpenTelemetry SDK 2.11.

Generated UltraModern workspaces pin the same cohort plus Oxlint 1.81.0, Oxfmt
0.66.0, Ultracite 7.11.0, Zephyr 1.2.4, `@types/node@^26.4.1` and
`@cloudflare/workers-types@5.20260906.1`. TanStack router-core 1.171.28 ships
corrected SSR declarations, so the fork's router-core declaration patch is
retired; the Zod and msgpackr CSP patches are regenerated for their new
versions. Expired static release-age exclusions and the archived improvement
campaign logs are removed.

Retire the expired acceptance-policy approvals as well as generator defaults.
Migration recognizes the exact historical Rsbuild/Rspack 2.2.0 selectors only
for removal, while unknown neighboring versions and unmatched audit entries
remain rejected.
