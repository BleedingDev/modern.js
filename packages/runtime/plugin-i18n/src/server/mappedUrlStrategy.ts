import {
  canonicalTargetPathname,
  isDefaultLocaleRedirectSkipPath,
  type LocalisedUrlsOption,
  localiseTargetPathname,
} from '@modern-js/i18n-runtime-extensions';
import type { I18nUrlStrategy } from '../shared/urlStrategy';

/**
 * Build the URL policy from a mapped-locale-URL configuration.
 *
 * `localeDetection.localisedUrls` is plain data, so unlike a `urlStrategy`
 * object it survives the JSON boundary between `modern.config.ts` and the
 * generated runtime registration. It is therefore the configuration the server
 * can rely on for mapped URLs. This lives on the server side only: the fork's
 * URL engine must stay out of the native client runtime bundle.
 */
export const createMappedUrlStrategy = (
  localisedUrls?: LocalisedUrlsOption,
): I18nUrlStrategy => ({
  localizePathname: (pathname, language, languages) =>
    localiseTargetPathname(pathname, language, [...languages], localisedUrls),
  canonicalPathname: (pathname, languages) =>
    canonicalTargetPathname(pathname, [...languages], localisedUrls),
  shouldSkipRedirect: (pathname, languages) =>
    isDefaultLocaleRedirectSkipPath(pathname, [...languages]),
});

/** Only a non-empty map needs a derived policy. */
export const resolveMappedUrlStrategy = (
  localeDetection: unknown,
): I18nUrlStrategy | undefined => {
  if (!localeDetection || typeof localeDetection !== 'object') {
    return undefined;
  }
  const localisedUrls = Reflect.get(localeDetection, 'localisedUrls');
  if (
    !localisedUrls ||
    typeof localisedUrls !== 'object' ||
    Object.keys(localisedUrls).length === 0
  ) {
    return undefined;
  }
  return createMappedUrlStrategy(localisedUrls as LocalisedUrlsOption);
};
