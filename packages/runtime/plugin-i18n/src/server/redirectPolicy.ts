import { isDefaultLocaleRedirectSkipPath } from '../shared/mappedUrlStrategy';
import { asI18nUrlStrategy, type I18nUrlStrategy } from '../shared/urlStrategy';

interface LocaleRedirectRequest {
  url: string;
  header?: () => { host?: string };
}

const stripUrlPathPrefix = (pathname: string, urlPath: string): string => {
  const basePath = urlPath.replace('/*', '');
  if (!basePath || basePath === '/') {
    return pathname;
  }
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length) || '/'
    : pathname;
};

export const shouldIgnoreRedirect = (
  pathname: string,
  urlPath: string,
  ignoreRedirectRoutes?: string[] | ((pathname: string) => boolean),
  urlStrategy?: I18nUrlStrategy,
  languages: string[] = [],
): boolean => {
  const remainingPath = stripUrlPathPrefix(pathname, urlPath);
  // Federation artifacts (`backend-mf-manifest.json`, `backendRemoteEntry.cjs`,
  // `mf-manifest.json`, …) are never pages: redirecting them to a locale
  // prefix hands a remote consumer an HTML document. This is native policy and
  // does not depend on a URL strategy being configured; a strategy can only
  // add exclusions.
  if (isDefaultLocaleRedirectSkipPath(remainingPath, languages)) {
    return true;
  }
  if (
    asI18nUrlStrategy(urlStrategy)?.shouldSkipRedirect?.(
      remainingPath,
      languages,
    )
  ) {
    return true;
  }
  if (!ignoreRedirectRoutes) {
    return false;
  }
  const segments = remainingPath.split('/').filter(Boolean);
  if (
    segments[0] &&
    languages.some(
      language => language.toLowerCase() === segments[0].toLowerCase(),
    )
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

/** Native configured/static exclusions remain in effect for every strategy. */
export const isStaticResourceRequest = (
  pathname: string,
  staticRoutePrefixes: string[],
  languages: string[] = [],
): boolean => {
  const prefixes = [...staticRoutePrefixes, '/static', '/upload'];
  const matches = (target: string) =>
    prefixes.some(
      prefix => target === prefix || target.startsWith(`${prefix}/`),
    );
  if (matches(pathname)) {
    return true;
  }
  const segments = pathname.split('/').filter(Boolean);
  if (
    segments[0] &&
    languages.some(
      language => language.toLowerCase() === segments[0].toLowerCase(),
    )
  ) {
    return matches(`/${segments.slice(1).join('/')}`);
  }
  return false;
};

export const getLanguageFromPath = (
  req: LocaleRedirectRequest,
  urlPath: string,
  languages: string[],
): string | null => {
  const host = req.header?.().host;
  const url = new URL(req.url, host ? `http://${host}` : undefined);
  const firstSegment = stripUrlPathPrefix(url.pathname, urlPath)
    .split('/')
    .filter(Boolean)[0];
  return (
    languages.find(
      language => language.toLowerCase() === firstSegment?.toLowerCase(),
    ) ?? null
  );
};

export const buildLocalizedUrl = (
  req: LocaleRedirectRequest,
  urlPath: string,
  language: string,
  languages: string[],
  urlStrategy?: I18nUrlStrategy,
): string => {
  const url = new URL(req.url);
  const basePath = urlPath.replace('/*', '');
  const remainingPath = stripUrlPathPrefix(url.pathname, urlPath);
  const segments = remainingPath.split('/').filter(Boolean);
  if (
    segments[0] &&
    languages.some(item => item.toLowerCase() === segments[0].toLowerCase())
  ) {
    segments[0] = language;
  } else {
    segments.unshift(language);
  }
  const strategy = asI18nUrlStrategy(urlStrategy);
  const pathname = strategy
    ? strategy.localizePathname(remainingPath, language, languages)
    : `/${segments.join('/')}`;
  return `${basePath === '/' ? '' : basePath}${pathname}${url.search}${url.hash}`;
};

export const createLocaleRedirectResponse = (location: string): Response =>
  new Response(null, {
    status: 302,
    headers: {
      'Cache-Control': 'private, no-store',
      Location: location,
      Vary: 'Accept-Language, Cookie',
    },
  });
