---
'@modern-js/app-tools': patch
'@modern-js/ultramodern-app-tools': patch
---

Restore the fork's renderer and server behaviour for apps that use `appTools()`
directly. Head rendering, the HTML template, asset ordering, localised loaders,
BFF error responses, telemetry, module-federation CSS and asset cache headers
and static serving were moved into separate packages and only registered by
`ultramodernAppTools()`, so plain `appTools()` apps silently lost them. They are
now on by default again; pass `appTools({ rendererExtensions: false })` or
`appTools({ serverExtensions: false })` to leave them out. Composing
`ultramodernAppTools()` still works and never registers them twice.

The renderer plugin also no longer depends on the order its descriptor is
emitted in: it declares the runtime plugins whose root it wraps, and renders the
children it is handed when the root is not defined yet.
