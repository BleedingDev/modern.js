---
'@modern-js/ultramodern-create': patch
'@modern-js/federation-runtime': patch
---

Fix migration commands on Windows by resolving package-manager command shims, retaining slash-normalized manifest keys, and persisting canonical staging paths for crash recovery. Recognize CRLF checkouts of generated configuration templates while preserving consumer-authored bytes.

Declare the federation runtime peer against the current native runtime version.
