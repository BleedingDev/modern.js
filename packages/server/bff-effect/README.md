# @modern-js/bff-effect

Fork-owned Effect primitives for UltraModern.js BFF runtimes. The package
keeps the portable Effect handler, data-platform, native inferred clients,
and edge dispatcher behind standalone package entry points rather than growing
the upstream-owned `@modern-js/plugin-bff` implementation.

This package is maintained by the
[UltraModern.js fork](https://github.com/BleedingDev/ultramodern.js), not the
upstream Modern.js project.

## Entry points

- `@modern-js/bff-effect` and `@modern-js/bff-effect/effect` expose the Node
  Effect BFF runtime and handler contracts.
- `@modern-js/bff-effect/effect-edge` exposes the edge-safe dispatcher without
  a static Node built-in import.
- `@modern-js/bff-effect/effect-client` exposes the Effect client runtime.
- `@modern-js/bff-effect/data-platform` exposes batching, envelope, tracing,
  validation, and invalidation primitives.

Adapter lifecycle integration, Hono integration, server source loading, and
backend federation are intentionally owned by their respective packages.

## HTTP clients

Keep the `HttpApi` contract in a shared module and pass it to Effect's
`HttpApiClient.make` or `makeEffectHttpApiClient` from `/effect-client`.
Requests, responses, and declared errors are inferred from that contract.
No SDK generation or backend-entry import is required.

`defineEffectBff` creates server handlers. Its former `client` placeholder,
the `@api/index` client transform, and `/effect-client-runtime` have been
removed. Move consumers to the shared contract and execute native client
operations with Effect.

For APIs hosted through a cross-project plugin, pass `crossProject` to the
native client helper: `{ requestId: 'catalog', operationVersion: 2, prefix: '/api' }`.
Use the producer's request ID, package major version, and server mount path.
Effect HTTP middleware derives operation headers from the shared contract;
the server continues to reject missing or stale contract headers.
