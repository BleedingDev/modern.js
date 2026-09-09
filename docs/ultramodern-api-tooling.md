# Packaged MicroVertical API tooling

Generated shared API contracts import their common readiness and error definitions
from `@modern-js/bff-effect/microvertical-api`. The dependency belongs to the
generated workspace and API packages. Business endpoints and API metadata remain
in the application. Existing CRUD and cart operation IDs keep their public values.

`@modern-js/code-tools` supplies two commands:

| Command | Validation |
| --- | --- |
| `modern-api-check` | Consumer API files and the workspace runtime topology |
| `modern-api-check-files` | Consumer API files, for a pipeline that already validates runtime topology |

Both commands accept `--workspace-root <directory>`. Exit status is `0` for valid
input, `1` for consumer diagnostics and `2` for a tooling failure. The checker
resolves the installed BFF owner and public exports, then checks the consumer's
reachable endpoint composition using bounded analysis in the current process.
It does not start the TypeScript native compiler.

Generated `api:check` uses the full command. The aggregate generated pipeline uses
the files command after its existing topology validation. Running ordinary lint
alone does not replace the full API check.

The existing `migrate:strict-effect` workflow upgrades supported generated
workspaces. It removes the old local baseline and checker files only when their
contents match a known generated version. Customized copies produce a conflict
before the migration promotes its staged changes; review and resolve the custom
behavior instead of deleting it or adding a compatibility alias. Unrelated
consumer scripts, configuration and package overrides retain their ownership.
