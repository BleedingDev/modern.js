---
'@modern-js/builder': patch
---

Restate the project's `references` in the native type checker's generated config.

The tsgo checker runs against a generated config written to
`<app>/.modern-js/tsgo/tsconfig.<hash>.json` that `extends` the project's own
tsconfig. `references` is the one top-level tsconfig property TypeScript never
inherits through `extends`, so the generated config silently dropped every
project reference. A referenced sibling then stopped being a project boundary:
its sources were pulled into this app's program and type-checked against this
app's globals instead of being redirected to the sibling's own declarations.

In a Module Federation workspace this failed the consumer's build on the
producer's typed links, because the producer's TanStack `Link` was resolved
against the consumer's `Register` route tree:

```
UltramodernNativeTypeChecker failed:
  ../../../checkout/src/components/add-to-cart.tsx(40,9): error TS2322:
  Type '"/$lang/cart"' is not assignable to type '"." | ".." | "/" | "/$lang" | …'
```

The generated config now carries the project's own `references`, each path
resolved against the config that declares it, so the checker sees the same
project graph the project's tsconfig describes.

The native checker also regenerates the config from the project's tsconfig
before every run and watches that tsconfig, so a reference added, removed or
retargeted during `modern dev` reaches the next compilation instead of the next
restart.
