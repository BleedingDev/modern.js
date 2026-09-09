import type { RuntimePluginAPI } from '@modern-js/plugin/runtime';
import { FederatedI18nBoundary } from './boundary';

export function registerFederatedI18nBoundary(api: RuntimePluginAPI<{}>): void {
  api.resolveComponent((component, { name }) =>
    name === 'i18n.FederatedI18nBoundary' ? FederatedI18nBoundary : component,
  );
}
