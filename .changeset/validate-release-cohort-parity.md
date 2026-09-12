---
'@modern-js/ultramodern-create': patch
---

`ultramodern validate` checks that the workspace's `.modernjs/release-cohort.json`
equals the authenticated projection shipped by the installed create package.

A cohort adoption done as a version-string bump keeps the previous cohort's
`source.commit`, and nothing downstream reads that field, so the misreported
provenance was silent (both the Tractor and the OntOS `3.9.0-ultramodern.9`
adoptions shipped it until a reviewer noticed). The validator now names the
differing JSON paths and the template file to copy, exactly as it already does
for a stale cohort patch.
