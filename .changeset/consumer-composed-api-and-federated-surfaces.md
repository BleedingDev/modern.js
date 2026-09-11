---
'@modern-js/ultramodern-create': patch
'@modern-js/code-tools': patch
---

Let a MicroVertical root API compose sub-APIs that live in other files. The API baseline rule now follows relative imports and re-exports to find each composed declaration, so a root contract that grows past a single file is accepted. Every endpoint check is unchanged and still runs on the declaration it resolves to, and an identifier the rule cannot resolve is still a violation.

Accept the Effect chain combinators that add no endpoints — `middleware`, `annotate`, `annotateMerge`, `annotateEndpoints`, `annotateEndpointsMerge` and `prefix` — on an API or group. A group that attaches middleware or annotations is no longer mistaken for an unbounded one, `prefix` is applied to the routes it rewrites rather than ignored, and any other chain call is still rejected.

Let the generated API client spread across per-operation modules. The client surface check now follows relative imports, so the required imports and calls may live in sibling modules the client composes, and it matches a relative import by the file it resolves to rather than by the exact specifier text.

Parse `.ts` consumer files as TypeScript without JSX, so a generic arrow function such as `const f = <T>(value: T) => value` no longer reports a syntax error. `.tsx` files are still parsed with JSX.

Take the files `ultramodern validate` requires for a federated surface from the vertical's own Module Federation config instead of assuming a `src/components` layout, so a vertical may keep its exposed surfaces wherever it likes. A surface that is declared but missing from disk still fails, and newly generated verticals keep using `src/components`.
