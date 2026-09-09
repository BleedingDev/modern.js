---
"@modern-js/runtime": patch
"@modern-js/runtime-extensions": patch
---

Preserve public and internal React context identity across separately bundled runtime copies. Localized SSR now reads the current request language through the same provider used by the renderer, including Module Federation applications.
