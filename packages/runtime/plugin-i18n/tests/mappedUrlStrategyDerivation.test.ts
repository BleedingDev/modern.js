import { describe, expect, test } from '@rstest/core';
import { resolveMappedUrlStrategy } from '../src/shared/mappedUrlStrategy';

/**
 * Mapped locale URLs must work for a bare `appTools()` consumer that only
 * declares `localeDetection.localisedUrls`. The map is plain data, so it
 * survives the JSON boundary a `urlStrategy` object does not; the runtime
 * derives its policy from it, and the server derives the same policy from the
 * same shared module.
 */

const localisedUrls = {
  '/terms-of-service': { en: '/terms-of-service', cs: '/obchodni-podminky' },
  '/products/:slug': { en: '/products/:slug', cs: '/produkty/:slug' },
};
const languages = ['en', 'cs'];

describe('mapped url strategy derivation', () => {
  test('derives a localizing strategy from localisedUrls', () => {
    const strategy = resolveMappedUrlStrategy({ localisedUrls });

    expect(strategy).toBeDefined();
    expect(
      strategy?.localizePathname?.('/terms-of-service', 'cs', languages),
    ).toBe('/cs/obchodni-podminky');
    expect(
      strategy?.localizePathname?.('/terms-of-service', 'en', languages),
    ).toBe('/en/terms-of-service');
    expect(
      strategy?.canonicalPathname?.('/cs/obchodni-podminky', languages),
    ).toBe('/terms-of-service');
  });

  test('round-trips a parameterised mapped route', () => {
    const strategy = resolveMappedUrlStrategy({ localisedUrls });
    const localized = strategy?.localizePathname?.(
      '/products/widget',
      'cs',
      languages,
    );

    expect(localized).toBe('/cs/produkty/widget');
    expect(strategy?.canonicalPathname?.(localized!, languages)).toBe(
      '/products/widget',
    );
  });

  test('leaves unmapped paths on the plain language prefix', () => {
    const strategy = resolveMappedUrlStrategy({ localisedUrls });

    expect(strategy?.localizePathname?.('/unmapped', 'cs', languages)).toBe(
      '/cs/unmapped',
    );
  });

  test('derives nothing without a usable map', () => {
    expect(resolveMappedUrlStrategy(undefined)).toBeUndefined();
    expect(resolveMappedUrlStrategy({})).toBeUndefined();
    expect(resolveMappedUrlStrategy({ localisedUrls: {} })).toBeUndefined();
    expect(resolveMappedUrlStrategy({ localisedUrls: true })).toBeUndefined();
  });
});
