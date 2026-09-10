---
"@modern-js/image": patch
"@modern-js/plugin-ssg": patch
"@modern-js/plugin-styled-components": patch
---

Restore image declarations at the published paths and emit separate ESM declaration identities for SSG and styled-components. Native NodeNext imports and CommonJS consumers retain their advertised default and named APIs.
