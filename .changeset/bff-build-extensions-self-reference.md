---
'@modern-js/plugin-bff-build-extensions': patch
---

Fix `Cannot find module '@modern-js/plugin-bff-build-extensions/hono-client-codegen'`
during `modern build`. The plugin resolved a file it ships by its own public
package name, which only works where the package can see itself in a
`node_modules` directory — not under an isolated (pnpm) layout. It now resolves
the file next to itself, which works in every layout.
