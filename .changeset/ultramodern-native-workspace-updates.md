---
'@modern-js/ultramodern-create': patch
'@modern-js/runtime-extensions': patch
'@modern-js/bff-effect': patch
'@modern-js/runtime': patch
---

Use packaged workspace validation, materialization, event contracts and Effect runtime assembly instead of copying framework implementations into generated applications. Preserve consumer changes during upgrades and recover interrupted workspace publication before retrying.

Generate the shared formatter preset with printWidth 120 and trailingComma all. Recognize generated source across formatter changes while retaining consumer configuration and code edits.

Move the fork boundary debugger to @modern-js/runtime-extensions/boundary-debugger and update newly generated applications to use its native runtime plugin export.
