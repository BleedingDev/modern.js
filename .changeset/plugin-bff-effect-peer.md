---
'@modern-js/plugin-bff': minor
---

Declare `effect` and `@effect/opentelemetry` as optional exact peer dependencies
of `@modern-js/plugin-bff` instead of bundled runtime dependencies. Both peers
are pinned to the UltraModern Effect cohort, `4.0.0-rc.112`, so consumers use
one Effect module identity and upgrade the pair together.

Declare `@modern-js/app-tools` as an optional peer while retaining it for
development, because the public CLI declaration references app-tools types but
runtime-only consumers must not be forced to install the application solution.

`@modern-js/plugin-bff/server-plugin` now loads the Effect adapter through a
dynamic import, so the Hono lane no longer pulls `effect/*` into its eager module
graph. Effect, edge, client, and data-platform APIs are owned by
`@modern-js/bff-effect`; integration uses `@modern-js/plugin-bff-extensions`.

Move builder and esbuild to development-only dependencies, remove telemetry and
federation runtime dependencies whose consumers moved to the extracted owners,
and map the package root declaration directly to `cli.d.ts`.

Remove the forgeable `EFFECT_VALIDATOR_AWARE_FACTORY` and
`isValidatorAwareHandlerFactory` public APIs. Validator-aware factories are now
trusted through private `WeakSet` registration inside `@modern-js/bff-effect`.
