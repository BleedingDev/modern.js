---
'@modern-js/plugin-i18n': patch
---

Never locale-redirect federation artifacts, with or without a URL strategy.

`backend-mf-manifest.json`, `backendRemoteEntry.cjs`, `mf-manifest.json`,
`mf-stats.json` and `remoteEntry.js` are never pages. The native locale
redirect previously excluded them only through a configured URL strategy's
`shouldSkipRedirect`. Since mapped locale URLs stopped needing an extra plugin,
an app with `localeDetection.localisedUrls: {}` derives no strategy at all, so
the exclusions silently vanished and the server answered

```
GET /backend-mf-manifest.json -> 302 /en/backend-mf-manifest.json
```

handing a backend federation consumer an HTML document. This failed the
`3.9.0-ultramodern.9` clean-room acceptance ("Node backend federation proof
failed": the live manifest returned HTTP 404).

The exclusions are now native policy on both the server and the client redirect
path; a strategy can still add exclusions but is no longer required for these.
