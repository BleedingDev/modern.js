---
"@modern-js/runtime-extensions": patch
"@modern-js/runtime": patch
---

Move SSR route asset mapping and hydration script ordering into the fork-owned runtime extensions package, preserving route order, exact URL deduplication, and escaped script attributes through the existing runtime adapter.
