---
'@modern-js/app-tools-extensions': patch
---

`UltramodernNativeTypeChecker` regenerates a generated checker config from the
project's own tsconfig before each check and registers that tsconfig as a
watched input, so restated values such as project `references` stay current
during `modern dev`.
