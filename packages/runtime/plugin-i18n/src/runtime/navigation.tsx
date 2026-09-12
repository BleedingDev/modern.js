import { createI18nRouterNavigation } from '@modern-js/i18n-runtime-extensions/router-navigation';
import {
  I18nNavigationProvider,
  type I18nRouterAdapter,
  useNativeI18nRouterAdapter,
} from './routerAdapter';

/**
 * The seam, and only the seam. The selected-router navigation adapter is a
 * fork subsystem, so it lives in the fork-owned
 * `@modern-js/i18n-runtime-extensions` and is attached here through the
 * `NavigationProvider` extension point this package already exposes. The
 * factory takes this package's own primitives as arguments, so the fork
 * package never imports back into it and the dependency stays one-way.
 */
export const { I18nRouterNavigationProvider, useIntegratedRouterAdapter } =
  createI18nRouterNavigation<I18nRouterAdapter>({
    I18nNavigationProvider,
    useNativeI18nRouterAdapter,
  });
