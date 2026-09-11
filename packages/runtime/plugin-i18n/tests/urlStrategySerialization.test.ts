import { describe, expect, test } from '@rstest/core';
import { buildLocalizedUrl, shouldIgnoreRedirect } from '../src/runtime/utils';
import { resolveMappedUrlStrategy } from '../src/server/mappedUrlStrategy';
import {
  buildLocalizedUrl as buildServerLocalizedUrl,
  shouldIgnoreRedirect as shouldIgnoreServerRedirect,
} from '../src/server/redirectPolicy';
import {
  asI18nUrlStrategy,
  isUnusableI18nUrlStrategy,
} from '../src/shared/urlStrategy';

// What a configured `urlStrategy` looks like after the generated runtime
// registration has carried it through JSON: an object with no methods left.
const serializedStrategy = {} as any;

const workingStrategy = {
  localizePathname: (pathname: string, language: string) =>
    `/${language}${pathname}`,
  canonicalPathname: (pathname: string) => pathname,
};

const createRequest = (pathname: string) =>
  ({ url: `https://example.test${pathname}` }) as any;

describe('URL strategy that lost its methods in transit', () => {
  test('is recognised as unusable rather than accepted', () => {
    expect(asI18nUrlStrategy(serializedStrategy)).toBeUndefined();
    expect(isUnusableI18nUrlStrategy(serializedStrategy)).toBe(true);
    expect(isUnusableI18nUrlStrategy(undefined)).toBe(false);
    expect(asI18nUrlStrategy(workingStrategy)).toBe(workingStrategy);
    expect(isUnusableI18nUrlStrategy(workingStrategy)).toBe(false);
  });

  test('a partial strategy is unusable too', () => {
    expect(asI18nUrlStrategy({ localizePathname: () => '/x' })).toBeUndefined();
  });

  test('the client link builder falls back instead of throwing', () => {
    expect(() =>
      buildLocalizedUrl('/about', 'cs', ['en', 'cs'], serializedStrategy),
    ).not.toThrow();
    expect(
      buildLocalizedUrl('/about', 'cs', ['en', 'cs'], serializedStrategy),
    ).toBe('/cs/about');
    expect(
      buildLocalizedUrl('/about', 'cs', ['en', 'cs'], workingStrategy),
    ).toBe('/cs/about');
  });

  test('the client redirect check falls back instead of throwing', () => {
    expect(() =>
      shouldIgnoreRedirect(
        '/about',
        ['en', 'cs'],
        undefined,
        serializedStrategy,
      ),
    ).not.toThrow();
    expect(
      shouldIgnoreRedirect(
        '/about',
        ['en', 'cs'],
        undefined,
        serializedStrategy,
      ),
    ).toBe(false);
  });

  test('the server redirect builder falls back instead of throwing', () => {
    expect(() =>
      buildServerLocalizedUrl(
        createRequest('/about'),
        '/*',
        'cs',
        ['en', 'cs'],
        serializedStrategy,
      ),
    ).not.toThrow();
    expect(
      buildServerLocalizedUrl(
        createRequest('/about'),
        '/*',
        'cs',
        ['en', 'cs'],
        serializedStrategy,
      ),
    ).toBe('/cs/about');
  });

  test('the server redirect skip check falls back instead of throwing', () => {
    expect(() =>
      shouldIgnoreServerRedirect(
        '/about',
        '/*',
        undefined,
        serializedStrategy,
        ['en', 'cs'],
      ),
    ).not.toThrow();
  });
});

describe('serializable mapped locale URLs', () => {
  test('produce a working strategy on the server', () => {
    const strategy = resolveMappedUrlStrategy({
      languages: ['en', 'cs'],
      localisedUrls: { '/about': { en: '/about', cs: '/o-nas' } },
    });

    expect(strategy).toBeDefined();
    expect(strategy?.localizePathname('/about', 'cs', ['en', 'cs'])).toBe(
      '/cs/o-nas',
    );
  });

  test('are absent when no map is configured', () => {
    expect(resolveMappedUrlStrategy(undefined)).toBeUndefined();
    expect(resolveMappedUrlStrategy({ languages: ['en'] })).toBeUndefined();
    expect(resolveMappedUrlStrategy({ localisedUrls: {} })).toBeUndefined();
  });
});
