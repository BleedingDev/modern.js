---
'@modern-js/utils': patch
'@modern-js/builder': patch
'@modern-js/app-tools': patch
'@modern-js/code-tools': patch
---

Repair the public CLI declaration closure for strict TypeScript 7 and Node-only consumers. Preserve prebundled runtime implementations, restore their matching declarations, and expose build-plugin configuration types without requiring Webpack.

Resolve owner-local Effect API imports consistently in symlinked workspaces while continuing to reject imports that escape the owner.
