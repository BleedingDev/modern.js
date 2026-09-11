---
'@modern-js/ultramodern-create': patch
'@modern-js/code-tools': patch
---

Let a MicroVertical root API compose sub-APIs that live in other files. The API baseline rule now follows relative imports and re-exports to find each composed declaration, so a root contract that grows past a single file is accepted. Every endpoint check is unchanged and still runs on the declaration it resolves to, and an identifier the rule cannot resolve is still a violation.

Take the files `ultramodern validate` requires for a federated surface from the vertical's own Module Federation config instead of assuming a `src/components` layout, so a vertical may keep its exposed surfaces wherever it likes. A surface that is declared but missing from disk still fails, and newly generated verticals keep using `src/components`.
