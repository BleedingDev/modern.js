---
'@modern-js/plugin-i18n': patch
---

Fix a `TypeError` during SSR for apps that set `urlStrategy` in
`modern.config.ts`. Plugin options reach the runtime as JSON, which drops the
strategy's methods, and every call site then used the empty object it became.
Mapped locale URLs are now derived from `localeDetection.localisedUrls` — which
is plain data and survives — on both the client and the server, and any strategy
value that cannot be used is ignored in favour of the built-in language-prefix
behaviour instead of throwing. Configuring `urlStrategy` this way now reports
what to configure instead.
