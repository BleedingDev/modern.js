---
'@modern-js/builder': patch
---

Fix builds failing with `TS5102: Option 'baseUrl' has been removed` when type
checking is enabled and the project's `tsconfig.json` still sets `baseUrl`. The
type checker gets the option blanked out again, so an existing tsconfig does not
have to be edited. `tools.tsChecker.typescript.tsgo: false` still selects the
classic checker.
