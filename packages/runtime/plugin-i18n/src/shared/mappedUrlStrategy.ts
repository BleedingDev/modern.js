import {
  canonicalTargetPathname,
  isDefaultLocaleRedirectSkipPath,
  type LocalisedUrlsOption,
  localiseTargetPathname,
} from '@modern-js/i18n-runtime-extensions';
import type { I18nUrlStrategy } from './urlStrategy';

/**
 * The fork's native locale-redirect exclusions (federation artifacts, static
 * and upload prefixes). Re-exported from this fork-owned seam so the native
 * runtime and server redirect paths apply them without importing the
 * extensions package themselves.
 */
export { isDefaultLocaleRedirectSkipPath } from '@modern-js/i18n-runtime-extensions';

/**
 * Build the URL policy from a mapped-locale-URL configuration.
 *
 * `localeDetection.localisedUrls` is plain data, so unlike a `urlStrategy`
 * object it survives the JSON boundary between `modern.config.ts` and the
 * generated runtime registration. It is therefore the one configuration both
 * sides can rely on for mapped URLs.
 *
 * This is shared rather than server-only on purpose. The server and the client
 * have to agree on the mapping or a hydrated `<Link>` navigates to a path the
 * server will not serve: SSR renders `/cs/obchodni-podminky` while a
 * client-side navigation asks for `/cs/terms-of-service`. The helpers below are
 * pure pathname functions from `@modern-js/i18n-runtime-extensions`, so the
 * client cost is a few hundred bytes of string work and no i18n engine.
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
