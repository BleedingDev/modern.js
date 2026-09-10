---
'@modern-js/ultramodern-create': patch
---

Limit API migration scans to governed workspace source, including declared custom packages and configured app and bridge roots, so unrelated reference checkouts do not block upgrades. Keep symlink and ownership checks within the selected source scope.
