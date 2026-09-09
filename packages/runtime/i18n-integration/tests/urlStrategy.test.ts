import { describe, expect, test } from '@rstest/core';
import { createI18nUrlStrategy } from '../src/urlStrategy';

describe('entry-owned URL strategies', () => {
  test('keeps concurrent locale maps independent', () => {
    const main = createI18nUrlStrategy({
      '/about': { en: '/about', cs: '/o-nas' },
    });
    const admin = createI18nUrlStrategy({
      '/about': { en: '/about', cs: '/sprava' },
    });
    const languages = Object.freeze(['en', 'cs']);
    expect(main.localizePathname('/about', 'cs', languages)).toBe('/cs/o-nas');
    expect(admin.localizePathname('/about', 'cs', languages)).toBe(
      '/cs/sprava',
    );
    expect(main.canonicalPathname('/cs/o-nas', languages)).toBe('/about');
    expect(admin.canonicalPathname('/cs/sprava', languages)).toBe('/about');
    expect(main.localizePathname('/about', 'cs', languages)).toBe('/cs/o-nas');
  });

  test('preserves prefix-only behavior and excludes federation endpoint variants', () => {
    const strategy = createI18nUrlStrategy();
    expect(strategy.localizePathname('/en/about', 'cs', ['en', 'cs'])).toBe(
      '/cs/about',
    );
    expect(strategy.canonicalPathname('/cs/about', ['en', 'cs'])).toBe(
      '/about',
    );
    expect(
      strategy.shouldSkipRedirect?.('/cs/backendRemoteEntry.cjs', ['en', 'cs']),
    ).toBe(true);
    expect(strategy.shouldSkipRedirect?.('/products', ['en', 'cs'])).toBe(
      false,
    );
  });
});
