---
'@modern-js/builder': patch
---

Keep the native type checker's `rootDir` at the app root.

The tsgo checker runs against a generated config written to
`<app>/.modern-js/tsgo/tsconfig.<hash>.json` that `extends` the project's own
tsconfig. Generated verticals set `composite: true` without an explicit
`rootDir`, and TypeScript defaults `rootDir` to the directory holding the
config — the generated directory — so every real source file landed outside the
root:

```
error TS6059: File '<app>/src/index.ts' is not under 'rootDir'
'<app>/.modern-js/tsgo'. 'rootDir' is expected to contain all source files.
```

The generated config now pins `rootDir` to the project directory when the
resolved config is `composite` and declares none, which is what the default
would have produced had the config not been relocated. Path-valued options
(`rootDir`, `outDir`, `declarationDir`) are also resolved to absolute paths
while the `extends` chain is merged, so a value inherited from a base config
cannot be re-anchored on the generated directory. A project that sets its own
`rootDir` is unchanged, and a non-composite project without one still gets
TypeScript's inference from the input files.
