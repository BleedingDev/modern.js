---
'@modern-js/ultramodern-create': patch
---

`ultramodern validate` now checks the workspace's `patches/` directory and its
`patchedDependencies` entries against the patches shipped by the installed
create package. A workspace left carrying a previous cohort's patch used to fail
much later, as an opaque module-resolution error inside `modern build`; it now
fails immediately with the name of the stale, missing or unregistered patch and
the exact template file to copy.
