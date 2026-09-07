---
'@modern-js/app-tools': patch
'@modern-js/builder': patch
'@modern-js/create': patch
'@modern-js/sandpack-react': patch
'@modern-js/utils': patch
---

Update the UltraModern.js baseline through Modern.js main commit
`b6f7840959947411e6f309d207e5572f907bccc0`, following the Modern.js 3.9.0 release.
Adopt upstream's Rslib 1.0 upgrade, default ESM external handling, corrected
create-package build configuration, static Sandpack template imports, and package
entry cleanup.

UltraModern.js retains its native TS-Go server compiler. Upstream #8844 selects a
JavaScript TypeScript compiler through `ts-node.compiler`; that loader is absent
from the native pipeline, so this upstream change does not apply. Native compiler
selection continues to resolve the application's `@typescript/native` installation
and retain the existing `@typescript/native-preview` fallback.
