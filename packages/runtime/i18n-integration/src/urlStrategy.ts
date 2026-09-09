import {
  canonicalTargetPathname,
  isDefaultLocaleRedirectSkipPath,
  type LocalisedUrlsOption,
  localiseTargetPathname,
} from '@modern-js/i18n-runtime-extensions';
import type { I18nUrlStrategy } from '@modern-js/plugin-i18n/runtime/no-react-i18next';

/** Each integration owns its map; no process-wide configuration is installed. */
export const createI18nUrlStrategy = (
  localisedUrls?: LocalisedUrlsOption,
): I18nUrlStrategy => ({
  localizePathname: (pathname, language, languages) =>
    localiseTargetPathname(pathname, language, [...languages], localisedUrls),
  canonicalPathname: (pathname, languages) =>
    canonicalTargetPathname(pathname, [...languages], localisedUrls),
  shouldSkipRedirect: (pathname, languages) =>
    isDefaultLocaleRedirectSkipPath(pathname, [...languages]),
});
