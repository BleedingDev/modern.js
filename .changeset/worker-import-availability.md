---
"@modern-js/app-tools-extensions": patch
---

Recognize native Worker compatibility imports, including the node:sqlite stub used by database adapter dependency graphs, without claiming that unsupported Node operations are implemented. Keep unknown builtin imports rejected.
