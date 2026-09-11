import type { LocalisedUrlsOption } from '@modern-js/i18n-runtime-extensions';
import type { I18nUrlStrategy } from '../shared/urlStrategy';
import { createMappedUrlStrategy } from './mappedUrlStrategy';

/**
 * Mapped locale URLs work without any extra plugin. `localeDetection.localisedUrls`
 * alone is enough: the server derives the URL policy from the map it is given.
 * An explicit `resolveUrlStrategy` still wins, so an integration can replace the
 * policy wholesale.
 */
export const createDefaultUrlStrategy = (
  localisedUrls?: LocalisedUrlsOption,
): I18nUrlStrategy => createMappedUrlStrategy(localisedUrls);

/** A non-empty map is the only configuration that needs a derived policy. */
export const resolveDefaultUrlStrategy = (
  localisedUrls: unknown,
): I18nUrlStrategy | undefined => {
  if (
    !localisedUrls ||
    typeof localisedUrls !== 'object' ||
    Object.keys(localisedUrls).length === 0
  ) {
    return undefined;
  }
  return createDefaultUrlStrategy(localisedUrls as LocalisedUrlsOption);
};
