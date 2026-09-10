---
'@modern-js/bff-effect': minor
'@modern-js/plugin-bff-extensions': minor
'@modern-js/plugin-bff-build-extensions': minor
'@modern-js/plugin-bff': patch
'@modern-js/app-tools': patch
'@modern-js/ultramodern-create': patch
---

Remove the reflected Effect SDK generator, its custom request runtime, and the `defineEffectBff().client` placeholder. Clients import a shared `HttpApi` contract and use native `HttpApiClient.make` or `makeEffectHttpApiClient`, preserving inferred request, response, error, and middleware types without client code generation.

Keep server operation-contract collection for worker and cross-project policy checks. Effect builds omit the generated producer-client configuration runtime, including stale artifacts. Empty client builds no longer advertise missing wildcard client exports. Migration reports removed generator imports with guidance to the shared-contract API.
