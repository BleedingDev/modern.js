---
'@modern-js/plugin-i18n': patch
'@modern-js/i18n-integration': patch
---

Give a bare `appTools()` consumer the selected-router navigation adapter.

`useNativeI18nRouterAdapter` only knows react-router's own hooks, so an app
composed from plain `appTools() + i18nPlugin()` while running the TanStack
router fell back to plain `<a>` elements and a non-reactive `window.location`.
Localised `<Link>`s rendered unmapped hrefs, a click left the document through a
full reload, and active state compared raw pathnames so the same page was
"active" in one language and not in another.

The selected-router adapter now lives in `@modern-js/plugin-i18n` and is the
default `NavigationProvider`, so the mapping reaches every consumer rather than
only those composed through `ultramodernAppTools()`. It reads the active router
out of the fork-owned router runtime-state slot, which keeps it router-agnostic
and adds no edge to the Nx graph — `@modern-js/i18n-integration` peer-depends on
`@modern-js/runtime`, so reaching it from the default app-tools path would close
a cycle, while `@modern-js/runtime-extensions` carries no such edge.
`@modern-js/i18n-integration` re-exports the module, so its own entry point and
any direct importer keep working, and a composing runtime plugin can still
supply its own `NavigationProvider`.
