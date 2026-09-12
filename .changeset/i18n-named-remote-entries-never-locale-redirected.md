---
'@modern-js/i18n-runtime-extensions': patch
---

The default locale-redirect exclusions recognise named federation remote
entries (`remoteEntry.<name>.js`, `backendRemoteEntry.<name>.cjs`), the same
shapes the federation layer serves, instead of only the unnamed
`remoteEntry.js` and `backendRemoteEntry.cjs`.
