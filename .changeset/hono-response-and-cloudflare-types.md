---
'@modern-js/plugin-bff-extensions': patch
'@modern-js/app-tools-extensions': patch
---

Preserve Hono's middleware return contract when cross-project policy calls the next handler: return actual Responses unchanged and allow ordinary void completion without leaking a Hono Context into dispatch.

Import the canonical fork BFF configuration types in Cloudflare build and worker manifest code so isolated builds retain precise Effect and cross-project options after native configuration cleanup.
