---
'@modern-js/plugin': minor
'@modern-js/runtime': minor
'@modern-js/render': patch
'@modern-js/server-core': minor
'@modern-js/prod-server': patch
'@modern-js/server-runtime-extensions': minor
---

Add a native runtime context projection hook that preserves the original request context and existing provider defaults. Repair native HTML and RSC stream injection for split UTF-8 and closing tags, empty streams, cancellation, and binary Flight payloads.

Expose native static asset response hooks and register fork precompression, federation, and generated public asset policies through the server plugin API. Preserve routing order and filesystem containment while honoring wildcard compression preferences.
