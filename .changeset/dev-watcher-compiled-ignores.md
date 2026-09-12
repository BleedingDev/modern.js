---
'@modern-js/server': patch
---

Exclude nested node_modules from server source watching, including dependencies reached through shared workspace symlinks, so installed dependency events do not trigger runtime reloads. Reuse compiled dependency ignore patterns and filtered graph membership when rebuilding the dev server require-cache graph, preventing large file-event bursts from spending the main thread repeatedly compiling globs.
