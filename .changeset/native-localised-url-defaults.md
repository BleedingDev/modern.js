---
'@modern-js/plugin-i18n': patch
'@modern-js/i18n-integration': patch
---

Make mapped locale URLs work for a bare `appTools()` consumer.

Localised route generation and the client URL policy used to be registered only
by `ultramodernI18nIntegrationPlugin`, so an app that declared
`localeDetection.localisedUrls` alongside plain `appTools()` got its mapped
paths 404ed under SSR and its hydrated `<Link>`s pointing at canonical paths the
server would not serve.

`@modern-js/plugin-i18n` now owns both halves:

- its CLI plugin expands file-system routes from `localeDetection.localisedUrls`;
- its runtime derives a mapped URL strategy from the same field when no usable
  `urlStrategy` is supplied.

Both read the one shared implementation the server already used, so the client
and the server cannot disagree about a mapping. `localisedUrls` is now a
declared option on `localeDetection` rather than an untyped extra.
`ultramodernAppTools()` composition is unchanged: an explicit `urlStrategy` from
`@modern-js/i18n-integration` still wins, and that package keeps the runtime
module swap it alone can provide.
