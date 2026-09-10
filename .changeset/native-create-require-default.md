---
"@modern-js/builder": patch
---

Restore the framework default that bundles relative dependencies loaded through Node createRequire. Apply the default when creating the builder and preserve explicit consumer overrides. Verify deployed output after removing the source dependency.
