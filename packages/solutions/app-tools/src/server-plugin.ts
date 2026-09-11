/**
 * The fork's default server policy (localised loaders, error responses,
 * telemetry, module-federation CSS and asset headers, static serving).
 *
 * It is exposed from `@modern-js/app-tools` so a plain `appTools()` app can
 * load it by a specifier it is guaranteed to be able to resolve: every app
 * declares `@modern-js/app-tools`, but not necessarily
 * `@modern-js/server-runtime-extensions`.
 */
export { default } from '@modern-js/server-runtime-extensions/server-plugin';
