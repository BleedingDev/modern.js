import { describe, expect, test } from '@rstest/core';
import { shouldIgnoreRedirect as shouldIgnoreRuntimeRedirect } from '../src/runtime/utils';
import {
  isStaticResourceRequest,
  shouldIgnoreRedirect as shouldIgnoreServerRedirect,
} from '../src/server/redirectPolicy';

describe('native locale redirect safeguards', () => {
  test('never locale-redirects federation artifacts, with no URL strategy configured', () => {
    // 3.9.0-ultramodern.9 regression: with `localisedUrls: {}` no strategy is
    // derived, and the backend federation manifest was redirected to
    // `/en/backend-mf-manifest.json` (an HTML page) — the Node backend
    // federation proof then read a 404 instead of the manifest.
    const languages = ['en', 'cs'];
    for (const pathname of [
      '/backend-mf-manifest.json',
      '/backendRemoteEntry.cjs',
      '/mf-manifest.json',
      '/mf-stats.json',
      '/remoteEntry.js',
      '/remoteEntry.catalog.js',
      '/backendRemoteEntry.catalog.cjs',
      '/cs/backend-mf-manifest.json',
    ]) {
      expect(
        shouldIgnoreServerRedirect(
          pathname,
          '/*',
          undefined,
          undefined,
          languages,
        ),
      ).toBe(true);
      expect(
        shouldIgnoreServerRedirect(
          `/app${pathname}`,
          '/app/*',
          undefined,
          undefined,
          languages,
        ),
      ).toBe(true);
      expect(
        shouldIgnoreRuntimeRedirect(pathname, languages, undefined, undefined),
      ).toBe(true);
    }
    // A page is still redirected.
    expect(
      shouldIgnoreServerRedirect(
        '/products',
        '/*',
        undefined,
        undefined,
        languages,
      ),
    ).toBe(false);
    expect(
      shouldIgnoreRuntimeRedirect('/products', languages, undefined, undefined),
    ).toBe(false);
  });

  test('retains configured ignores across runtime and server entry prefixes', () => {
    const rules = ['/private'];
    expect(
      shouldIgnoreRuntimeRedirect('/cs/private/data', ['en', 'cs'], rules),
    ).toBe(true);
    expect(
      shouldIgnoreRuntimeRedirect('/cs/private-data', ['en', 'cs'], rules),
    ).toBe(false);
    expect(
      shouldIgnoreServerRedirect(
        '/app/cs/private/data',
        '/app/*',
        rules,
        undefined,
        ['en', 'cs'],
      ),
    ).toBe(true);
    expect(
      shouldIgnoreServerRedirect(
        '/app/cs/private-data',
        '/app/*',
        rules,
        undefined,
        ['en', 'cs'],
      ),
    ).toBe(false);
  });
  test('retains configured and native static paths without fork policy', () => {
    for (const pathname of [
      '/static/app.js',
      '/upload/a.png',
      '/cs/assets/main.js',
    ]) {
      expect(isStaticResourceRequest(pathname, ['/assets'], ['en', 'cs'])).toBe(
        true,
      );
    }
    expect(
      isStaticResourceRequest(
        '/assets-other/main.js',
        ['/assets'],
        ['en', 'cs'],
      ),
    ).toBe(false);
  });
});
