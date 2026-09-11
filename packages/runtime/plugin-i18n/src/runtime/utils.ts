import { isBrowser } from '@modern-js/runtime';
import { getGlobalBasename } from '@modern-js/runtime/context';
import { splitUrlTarget } from '@modern-js/runtime-utils/url';
import { asI18nUrlStrategy, type I18nUrlStrategy } from '../shared/urlStrategy';

export { splitUrlTarget } from '@modern-js/runtime-utils/url';

// Structural parameter: hooks.ts passes a public-TRuntimeContext-based
// context while core.tsx passes the internal one; both carry the request
// pathname shape this helper needs.
export const getPathname = (context: {
  ssrContext?: { request?: { pathname?: string } };
}): string => {
  if (isBrowser()) {
    return window.location.pathname;
  }
  return context.ssrContext?.request?.pathname || '/';
};

export const getEntryPath = (): string => {
  const basename = getGlobalBasename();
  if (basename) {
    return basename === '/' ? '' : basename;
  }
  return '';
};
/**
 * Helper function to get language from current pathname
 * @param pathname - The current pathname
 * @param languages - Array of supported languages
 * @param fallbackLanguage - Fallback language when no language is detected
 * @returns The detected language or fallback language
 */
export const getLanguageFromPath = (
  pathname: string,
  languages: string[],
  fallbackLanguage: string,
): string => {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (languages.includes(firstSegment)) {
    return firstSegment;
  }

  return fallbackLanguage;
};

/**
 * Helper function to build localized URL
 * @param target - The language-agnostic target; may include `?search` and `#hash`
 * @param language - The target language
 * @param languages - Array of supported languages
 * @returns The localized URL path with search and hash re-appended verbatim
 */
export const buildLocalizedUrl = (
  target: string,
  language: string,
  languages: string[],
  urlStrategy?: I18nUrlStrategy,
): string => {
  const { pathname, search, hash } = splitUrlTarget(target);
  const strategy = asI18nUrlStrategy(urlStrategy);
  if (strategy) {
    return `${strategy.localizePathname(pathname, language, languages)}${search}${hash}`;
  }
  const segments = pathname.split('/').filter(Boolean);
  if (
    segments[0] &&
    languages.some(item => item.toLowerCase() === segments[0].toLowerCase())
  ) {
    segments[0] = language;
  } else {
    segments.unshift(language);
  }
  const localizedPathname = `/${segments.join('/')}`;

  return `${localizedPathname}${search}${hash}`;
};

export const detectLanguageFromPath = (
  pathname: string,
  languages: string[],
  localePathRedirect: boolean,
): {
  detected: boolean;
  language?: string;
} => {
  if (!localePathRedirect) {
    return { detected: false };
  }

  const entryPath = getEntryPath();
  const relativePath = pathname.replace(entryPath, '');
  const segments = relativePath.split('/').filter(Boolean);

  // If entryPath is empty and first segment is not a language,
  // it might be an entry path (e.g., /lang/en -> lang is entry, en is language)
  const segmentsToCheck =
    !entryPath &&
    segments.length > 1 &&
    segments[0] &&
    !languages.includes(segments[0])
      ? segments.slice(1) // Skip the first segment (entry path) and check the second segment
      : segments;

  const firstSegment = segmentsToCheck[0];

  if (firstSegment && languages.includes(firstSegment)) {
    return { detected: true, language: firstSegment };
  }

  return { detected: false };
};

/**
 * Check if the given pathname should ignore automatic locale redirect
 */
export const shouldIgnoreRedirect = (
  pathname: string,
  languages: string[],
  ignoreRedirectRoutes?: string[] | ((pathname: string) => boolean),
  urlStrategy?: I18nUrlStrategy,
): boolean => {
  if (
    asI18nUrlStrategy(urlStrategy)?.shouldSkipRedirect?.(pathname, languages)
  ) {
    return true;
  }
  if (!ignoreRedirectRoutes) {
    return false;
  }
  const segments = pathname.split('/').filter(Boolean);
  if (
    segments[0] &&
    languages.some(item => item.toLowerCase() === segments[0].toLowerCase())
  ) {
    segments.shift();
  }
  const normalizedPath = `/${segments.join('/')}`;
  return typeof ignoreRedirectRoutes === 'function'
    ? ignoreRedirectRoutes(normalizedPath)
    : ignoreRedirectRoutes.some(
        pattern =>
          normalizedPath === pattern ||
          normalizedPath.startsWith(`${pattern}/`),
      );
};
