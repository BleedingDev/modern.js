---
'@modern-js/ultramodern-create': patch
---

Generate MicroVertical foundation imports from the native bff-effect package and run the packaged API checks. Upgrades retire only hash-proven generated baseline and checker copies, migrate supported public imports transactionally, and stop before promotion when customized files or exports need an explicit consumer migration. Combined workspace checks run topology once while standalone API checks retain full coverage.

Ownership checks reject linked ancestors and hidden linked callers, confirm the actual public root export, and stop on unsupported dynamic root references before removing a generated public barrel.
