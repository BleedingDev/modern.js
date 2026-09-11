---
'@modern-js/app-tools': minor
'@modern-js/runtime': minor
'@modern-js/app-tools-extensions': minor
'@modern-js/runtime-extensions': minor
'@modern-js/ultramodern-app-tools': minor
'@modern-js/boundary-debugger': minor
'@modern-js/federation-runtime': minor
'@modern-js/backend-federation-contracts': minor
'@modern-js/surface-resolution': minor
'@modern-js/ultramodern-create': minor
'@modern-js/plugin-bff-extensions': patch
'@modern-js/utils': minor
---

Move fork build, deployment, debugger, federation, and contract implementations into dedicated packages. Compose UltraModern build plugins through `@modern-js/ultramodern-app-tools`, preserving native plugin ordering, runtime context identity, and checked public declarations.

Generate the new package imports and dependencies directly.
