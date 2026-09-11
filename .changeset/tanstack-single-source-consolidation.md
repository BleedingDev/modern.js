---
'@modern-js/runtime': minor
'@modern-js/plugin-tanstack': minor
'@modern-js/plugin-i18n': patch
---

Consolidate TanStack router runtime and route generation in `@modern-js/plugin-tanstack`. Each application resolves its provider from an explicit local realm. Framework context access uses fork-owned typed state helpers.

TanStack applications declare `tanstackRouterPlugin()` and import router APIs from `@modern-js/plugin-tanstack/runtime`. Generated route declarations augment that package. Unknown providers fail closed.
