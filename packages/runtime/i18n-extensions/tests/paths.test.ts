import { describe, expect, test } from '@rstest/core';
import type { LocalisedUrlsMap } from '../src/localisedUrls';
import { buildLocalizedUrl, canonicalPath, localizePath } from '../src/paths';

const languages = ['en', 'cs'];

const localisedUrls = {
  '/products/:slug': {
    en: '/products/:slug',
    cs: '/produkty/:slug',
  },
  '/files/*': {
    en: '/files/*',
    cs: '/soubory/*',
  },
  '/app/products/:slug': {
    en: '/app/products/:slug',
    cs: '/app/produkty/:slug',
  },
} satisfies LocalisedUrlsMap;

const pathsConfig = {
  languages,
  localisedUrls,
};

describe('fork-owned localised URL rewrite matrix', () => {
  const rewriteScenarios = [
    {
      name: 'adds the target locale prefix and localises canonical segments',
      target: '/products/red-shoe',
      language: 'cs',
      expected: '/cs/produkty/red-shoe',
    },
    {
      name: 'strips a case-insensitive source locale before relocalising',
      target: '/CS/produkty/red%20shoe?tag=boots#details',
      language: 'en',
      expected: '/en/products/red%20shoe?tag=boots#details',
    },
    {
      name: 'preserves repeated query keys and the fragment',
      target: '/products/red-shoe?tag=boots&tag=sale#details',
      language: 'cs',
      expected: '/cs/produkty/red-shoe?tag=boots&tag=sale#details',
    },
    {
      name: 'keeps a base-path segment inside the localised route map',
      target: '/app/products/red-shoe?ref=nav#details',
      language: 'cs',
      expected: '/cs/app/produkty/red-shoe?ref=nav#details',
    },
    {
      name: 'keeps the default locale explicitly prefixed',
      target: '/products/red-shoe',
      language: 'en',
      expected: '/en/products/red-shoe',
    },
    {
      name: 'does not double-prefix an already-localised URL',
      target: '/cs/produkty/red-shoe?tag=boots#details',
      language: 'cs',
      expected: '/cs/produkty/red-shoe?tag=boots#details',
    },
  ];

  for (const scenario of rewriteScenarios) {
    test(scenario.name, () => {
      expect(
        buildLocalizedUrl(
          scenario.target,
          scenario.language,
          languages,
          localisedUrls,
        ),
      ).toBe(scenario.expected);
    });
  }

  test('canonical and localized path helpers strip and add prefixes exactly', () => {
    expect(
      canonicalPath('/CS/produkty/red-shoe?tag=boots#details', pathsConfig),
    ).toBe('/products/red-shoe?tag=boots#details');
    expect(
      localizePath('/products/red-shoe?tag=boots#details', 'cs', pathsConfig),
    ).toBe('/cs/produkty/red-shoe?tag=boots#details');
  });

  test('splat params preserve separators and percent-encode each segment', () => {
    expect(
      buildLocalizedUrl(
        '/files/resume%20drafts/Q1%20deck.pdf',
        'cs',
        languages,
        localisedUrls,
      ),
    ).toBe('/cs/soubory/resume%20drafts/Q1%20deck.pdf');
  });
  test('explicit maps work without plugin registration and keep suffixes verbatim', () => {
    const config = {
      languages,
      localisedUrls: {
        '/docs/:slug?': { en: '/docs/:slug?', cs: '/dokumenty/:slug?' },
      },
    };
    expect(localizePath('/docs?x=%2f&x=2#literal?query', 'cs', config)).toBe(
      '/cs/dokumenty?x=%2f&x=2#literal?query',
    );
    expect(canonicalPath('/cs/dokumenty/%E0%A4%A', config)).toBe(
      '/dokumenty/%E0%A4%A',
    );
    expect(localizePath('/[literal]?x=1#x', 'cs', { languages })).toBe(
      '/cs/[literal]?x=1#x',
    );
  });
});

describe('migrated public mapped helper contract', () => {
  const localisedUrls = {
    '/terms-of-service': {
      en: '/terms-of-service',
      cs: '/podminky-pouzivani',
    },
    '/products': {
      en: '/products',
      cs: '/produkty',
    },
    '/products/:slug': {
      en: '/products/:slug',
      cs: '/produkty/:slug',
    },
    // Canonical key that matches no language pattern.
    '/talks/:slug': {
      en: '/lectures/:slug',
      cs: '/prednasky/:slug',
    },
  };

  const languages = ['en', 'cs'];
  const pathsConfig = { languages, localisedUrls };

  test('query and hash survive localized slug mapping', () => {
    expect(
      buildLocalizedUrl(
        '/products/bota?tag=x#detail',
        'cs',
        languages,
        localisedUrls,
      ),
    ).toBe('/cs/produkty/bota?tag=x#detail');
  });

  test('localizes canonical keys that match no language pattern', () => {
    expect(
      buildLocalizedUrl(
        '/talks/ai-slop#abstract',
        'cs',
        languages,
        localisedUrls,
      ),
    ).toBe('/cs/prednasky/ai-slop#abstract');
    expect(
      buildLocalizedUrl('/talks/ai-slop', 'en', languages, localisedUrls),
    ).toBe('/en/lectures/ai-slop');
  });

  test('re-localizes already-localized paths', () => {
    expect(
      buildLocalizedUrl('/cs/produkty/bota#x', 'en', languages, localisedUrls),
    ).toBe('/en/products/bota#x');
  });
  test('localizePath maps canonical paths per language', () => {
    expect(localizePath('/products/bota', 'cs', pathsConfig)).toBe(
      '/cs/produkty/bota',
    );
    expect(localizePath('/talks/x', 'en', pathsConfig)).toBe('/en/lectures/x');
  });

  test('canonicalPath strips language and reverse-maps localized slugs', () => {
    expect(canonicalPath('/cs/produkty/bota', pathsConfig)).toBe(
      '/products/bota',
    );
    expect(canonicalPath('/en/lectures/x?q=1#h', pathsConfig)).toBe(
      '/talks/x?q=1#h',
    );
    expect(canonicalPath('/cs', pathsConfig)).toBe('/');
    expect(canonicalPath('/en/products', pathsConfig)).toBe('/products');
  });
});
