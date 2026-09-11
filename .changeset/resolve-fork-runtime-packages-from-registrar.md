---
'@modern-js/app-tools': patch
'@modern-js/app-tools-extensions': patch
'@modern-js/ultramodern-app-tools': patch
---

Fix `Module not found: Can't resolve '@modern-js/runtime-renderer-extensions'`
and the same error for `@modern-js/i18n-integration` in builds of apps that
declare only `@modern-js/ultramodern-app-tools`. The generated runtime
registration lives inside the app, so it could not see packages that are
dependencies of the plugin registering them. The registering package now
contributes the directory that hosts them as a resolution fallback, so an app
does not have to declare them itself. An app that does declare them still uses
its own copy.
