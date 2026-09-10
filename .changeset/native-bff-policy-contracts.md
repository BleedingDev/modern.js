---
'@modern-js/bff-core': minor
'@modern-js/bff-effect': minor
'@modern-js/create-request': minor
'@modern-js/plugin-bff': minor
'@modern-js/plugin-bff-extensions': minor
'@modern-js/plugin-bff-build-extensions': minor
'@modern-js/runtime-extensions': minor
'@modern-js/server-runtime-extensions': minor
'@modern-js/ultramodern-create': minor
'@modern-js/code-tools': minor
---

Compose fork BFF build and client policy through explicit native request hooks and a client code-generation extension. Preserve reflected handler metadata, producer IDs, generated SDK publication failures, and the shared configure/request module identity.

Use `@modern-js/plugin-bff-build-extensions` for fork build composition and `@modern-js/runtime-extensions/request-policy` for protected clients. Operation contracts and cross-project policy now belong to `@modern-js/server-runtime-extensions/bff-policy` and its Node subpath. Migrate imports from the former native BFF security exports; the native request entry retains its native transport API. Generated configurations adopt the canonical packages directly.

Restore `@modern-js/plugin-bff/server` to the native Hono API and retire the fork-added Effect, client, data-platform and `hono-server` aliases. Effect applications import framework helpers from `@modern-js/bff-effect/effect`, library namespaces from their `effect/*` modules, and worker helpers from `@modern-js/bff-effect/effect-edge`. Register adapters through the fork build plugin and declare `@modern-js/plugin-bff-extensions` as an application production dependency. Runtime selectors retain finite, extensible types and reject missing adapter registrations.
