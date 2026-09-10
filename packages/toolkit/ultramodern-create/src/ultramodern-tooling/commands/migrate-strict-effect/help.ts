export const migrateStrictEffectHelp = `Usage:
  ultramodern-create ultramodern migrate-strict-effect --version <version> [--dry-run] [--skip-install]

Run from the workspace root using the target release's CLI. Select the same
exact authenticated release cohort for the CLI package and --version.

This existing entry point handles release updates and recognized historical
migrations. A same-contract update changes dependency versions, lockfile and
release data; source/configuration changes are a migration. A matching compact
schema or package version alone does not prove the same-contract case.

Historical migration can update generated Effect API metadata, toolchain and
pnpm policy, TypeScript configuration and proven generated artifacts. Consumer
code, scripts and configuration keep their ownership. Ambiguous generated
regions or unsupported customizations produce a conflict with the affected
path; preserve the custom behavior when resolving it. Recognized legacy 3.2
metadata can supply a missing compact config.

--dry-run previews without changing live files and implies --skip-install.
It cannot prove target lock resolution. --skip-install skips dependency
installation and target checks, leaving validation incomplete. Normal runs
install and check the target in a private stage before promoting the lockfile
and other prepared changes. Staged node_modules is not promoted. After applying,
run pnpm install --frozen-lockfile, pnpm check and pnpm build. The aggregate
check includes API-file and contract checks; use pnpm api:check to diagnose
an API failure.

Do not add a vertical or run sync-delivery-unit merely to update packages.
Migration rollback covers tracked writes on failure, not subsequent installs
or edits. Inspect the error and workspace changes before retrying. Abrupt
termination during promotion is not a promised crash-atomic rollback.
`;
