---
'@modern-js/app-tools-extensions': patch
'@modern-js/plugin-bff-extensions': patch
'@modern-js/plugin-bff': patch
---

Recognize the networking, filesystem, utility and compression modules provided by the default Cloudflare nodejs_compat target, plus the platform's cloudflare:sockets import, when bundling and verifying Worker output.

Keep transitive API implementation files in the Effect BFF worker source graph instead of replacing them with browser-only API boundary diagnostics.
