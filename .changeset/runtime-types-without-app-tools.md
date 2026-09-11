---
'@modern-js/runtime': patch
'@modern-js/server-core': patch
'@modern-js/types': patch
---

Fix type checking failing in projects that install `@modern-js/runtime` without
`@modern-js/app-tools`. The runtime's published declarations referenced the
solution package, which it declares in neither `dependencies` nor
`peerDependencies`, so under an isolated (pnpm) layout a consumer had to add a
root dependency purely to satisfy `tsc`. The shared request types now come from
packages the runtime actually depends on.
