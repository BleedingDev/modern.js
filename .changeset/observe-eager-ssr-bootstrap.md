---
'@modern-js/runtime': patch
---

Keep Node running when an eager SSR bootstrap import fails before a request consumes it. The exported handler promise still rejects with the original error for normal request error handling.
