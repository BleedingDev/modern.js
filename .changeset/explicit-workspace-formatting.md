---
'@modern-js/ultramodern-create': patch
---

Keep generated postinstall focused on the skills bootstrap and run formatting explicitly with `pnpm format`. Migration removes known generated formatter steps while preserving custom hooks and formatter commands. Previously generated validators adopt the new contract only after the remaining program matches; authored validators and unsupported shell programs remain preserved.
