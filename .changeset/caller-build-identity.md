---
"@modern-js/runtime-extensions": patch
"@modern-js/ultramodern-create": patch
---

Read injected build constants in each generated delivery-unit module, so identity remains correct when the shared runtime helper is external to the application's bundle. Preserve uncompiled source evaluation and propagate unrelated reader errors.
