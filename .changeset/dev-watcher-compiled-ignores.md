---
'@modern-js/server': patch
---

Reuse compiled dependency ignore patterns and filtered graph membership when rebuilding the dev server require-cache graph, preventing large file-event bursts from spending the main thread repeatedly compiling globs.
