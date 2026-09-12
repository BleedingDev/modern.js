/**
 * The selected-router navigation adapter now lives in
 * `@modern-js/plugin-i18n`, so a bare `appTools() + i18nPlugin()` app gets
 * mapped `<Link>` navigation and language-invariant active state without this
 * integration package. Re-exported here so the composed
 * `ultramodernI18nIntegrationPlugin` keeps its own entry point and any consumer
 * importing it from this package continues to work.
 */
export {
  I18nRouterNavigationProvider,
  useIntegratedRouterAdapter,
} from '@modern-js/plugin-i18n/runtime/no-react-i18next';
