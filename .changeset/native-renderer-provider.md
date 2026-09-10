---
'@modern-js/plugin': minor
'@modern-js/runtime': minor
'@modern-js/render': minor
'@modern-js/runtime-extensions': minor
'@modern-js/runtime-renderer-extensions': minor
'@modern-js/ultramodern-app-tools': minor
'@modern-js/server-core': patch
'@modern-js/plugin-tanstack': patch
'@modern-js/ultramodern-create': patch
---

Expose native renderer lifecycle and component resolution hooks while preserving existing collector and stream extender behavior. Register UltraModern head rendering through these hooks, keeping request state and head policy in fork-owned packages and preserving the public runtime/head imports.

Keep request-valued providers outside React Server Component payloads, preserve context identity across independently bundled runtime entries, and propagate stream cancellation through renderer cleanup.

Reuse the native RSC renderer for the edge worker and retire the unused runtime-extensions/rsc-html-stream export. Preserve long HTML tags and delayed Flight payload ordering through the native renderer.

Move router state and server configuration declarations to fork-owned primitives while preserving their existing public interfaces.

Declare the renderer directly in generated and migrated app manifests so native runtime registration resolves under strict pnpm dependency isolation.
