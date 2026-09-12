---
'@modern-js/app-tools-extensions': patch
---

Stop failing `modern build` when the checkout is not promotable.

`resolveUltramodernSourceRevision` deliberately labels a dirty or non-Git
checkout with the `workspace` source revision so that development stays usable
and no release can ever carry dirty bytes under a clean HEAD. The release
envelope plugin then ran on `onAfterBuild` and rejected exactly that identity,
so a plain `modern build` of any app that was not a pristine Git checkout —
every freshly scaffolded workspace, and every local build with an edit in the
tree — exited 1 after reporting a completely successful build, with the reason
on stderr only.

The build phase now skips emitting the envelope for a non-promotable identity
instead of throwing. The gate itself is unchanged and still runs where a
promotion actually happens: `onBeforeDeploy` emits with the promotable
requirement in force and `verifyBuildOutputReleaseEnvelope` checks the result,
so a `workspace` revision still cannot reach a deploy.
