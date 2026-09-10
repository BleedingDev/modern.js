---
'@modern-js/bff-effect': minor
'@modern-js/plugin-bff-extensions': minor
'@modern-js/plugin-bff-build-extensions': minor
'@modern-js/plugin-bff': patch
'@modern-js/app-tools': patch
'@modern-js/ultramodern-create': patch
---

Remove the reflected Effect SDK generator, its custom request runtime, and the `defineEffectBff().client` placeholder. Clients import a shared `HttpApi` contract and use native `HttpApiClient.make` or `makeEffectHttpApiClient`, preserving inferred request, response, error, and middleware types without client code generation.

Keep server operation-contract collection for worker and cross-project policy checks. Effect builds omit the generated producer-client configuration runtime, including stale artifacts. Empty client builds no longer advertise missing wildcard client exports. Remove the unused server-side `batch.flushIntervalMs` client-codegen option; native clients do not automatically batch requests. Migration reports removed generator imports with guidance to the shared-contract API.

Native HTTP middleware supplies cross-project contract headers from the shared API when requested, preserving server checks for missing or stale contracts. Resolve server metadata through the owning package's Effect import. Reuse precompiled producer entries when hosting APIs, and support browser-only consumers without an API entry.
