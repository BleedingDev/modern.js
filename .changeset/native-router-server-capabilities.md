---
'@modern-js/plugin': minor
'@modern-js/app-tools': minor
'@modern-js/runtime': minor
'@modern-js/runtime-extensions': minor
'@modern-js/plugin-tanstack': minor
'@modern-js/plugin-data-loader': minor
'@modern-js/runtime-renderer-extensions': minor
'@modern-js/server-core': minor
'@modern-js/prod-server': minor
'@modern-js/server': minor
'@modern-js/server-runtime-extensions': minor
'@modern-js/ultramodern-app-tools': minor
---

Provide native router lifecycle, Link prefetch, renderer asset, request-local loader identity, server disposal, and error-response extension points. Register fork policies through the higher application composer while preserving native rendering, navigation, request handling, and cleanup ownership.

Import fork router state from `@modern-js/runtime-extensions/router-state` and fork server configuration from `@modern-js/server-runtime-extensions/server-config`. A typed runtime registry preserves checked BFF framework names across configuration and server context; prefetch modes retain the native finite union. Emit matching ESM and CommonJS declarations for the server and application integration packages.
