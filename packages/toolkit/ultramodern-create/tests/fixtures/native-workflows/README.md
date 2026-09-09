# Native workflow inputs

`commands.json` records actual CLI argument arrays. Replace `<V>` with the exact
release cohort version and invoke them through that release's
`@bleedingdev/modern-js-ultramodern-create` package. These inputs do not download
packages or claim that a particular release exists.

Run the command/help assertions from `packages/toolkit/ultramodern-create`:

```sh
pnpm exec rstest run tests/fixtures/native-workflows/command-help.test.ts
```

The assertions compare documentation inputs to the source command catalog, help
and generated script plans. They do not prove installed releases or runtime
behavior.

`add-shell.mts` calls the existing exported shell API. Run it from an installed
throwaway workspace that already has a `catalog` vertical, with the exact cohort
version as its argument. It creates `apps/shell-admin`; it is a mutation example.
The same API's `planUltramodernShell` method provides a preview.

`native-api.ts` composes a small Effect REST API using the same native exports as
the generated applications. It is server-only. In an application, keep the
browser-safe contract separate from the handler module. Preserve the generated
readiness contract and metadata when extending a real vertical.

`native-navigation.tsx` is a standalone TanStack route tree with validated search,
a locale parameter, a native Link and navigation from a filter button. Typecheck
it in isolation with the target React/TanStack dependencies. Generated file-route
apps keep their own registration; do not paste this second router into one.
Translated URL aliases require the application's existing i18n metadata.

Release qualification must run installed create/add/update/check/build and the
selected Node/workerd runtime journeys. These fixture inputs are not evidence of
cross-release preservation, legacy ownership recognition or crash recovery.
