---
'@modern-js/plugin-i18n': patch
'@modern-js/i18n-integration': patch
---

Fix servers refusing to start with `Mapped locale URLs require a URL strategy`
when `localeDetection.localisedUrls` is set. The URL policy is now derived from
the map itself, so an existing i18n configuration keeps working with no extra
plugin. Supplying `resolveUrlStrategy` still replaces the derived policy.
