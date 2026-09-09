---
"@modern-js/runtime-extensions": patch
"@modern-js/ultramodern-create": patch
---

Resolve compiled build identity in the runtime package and emit only the markers used by each generated surface. Migration keeps absent UI re-export files absent and declares the runtime dependency used by generated build modules.
