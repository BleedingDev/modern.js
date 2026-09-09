import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from '@rstest/core';

const require = createRequire(import.meta.url);
const packageDirectory = resolve(__dirname, '..');

describe('built public integration exports', () => {
  test('every descriptor-selected entry exposes the promised named factory in CJS and ESM', async () => {
    const manifest = JSON.parse(
      await readFile(resolve(packageDirectory, 'package.json'), 'utf8'),
    );
    for (const [subpath, name] of [
      ['.', 'ultramodernI18nIntegrationPlugin'],
      ['./cli', 'ultramodernI18nIntegrationPlugin'],
      ['./runtime', 'i18nPlugin'],
      ['./runtime/no-react-i18next', 'i18nPlugin'],
      ['./server', 'i18nServerPlugin'],
      ['./federation', 'FederatedI18nBoundary'],
    ]) {
      const entry = manifest.exports[subpath];
      const cjs = require(resolve(packageDirectory, entry.node.require));
      const esm = await import(
        pathToFileURL(resolve(packageDirectory, entry.node.import)).href
      );
      expect(typeof cjs[name]).toBe('function');
      expect(typeof esm[name]).toBe('function');
      const declaration = await readFile(
        resolve(packageDirectory, entry.types),
        'utf8',
      );
      expect(declaration).toContain(name);
      expect(declaration).not.toContain('/src/');
    }
  });

  test('mapped pure helpers work through public exports before any plugin runs', async () => {
    const cjs = require('@modern-js/i18n-runtime-extensions/paths');
    const esm = await import('@modern-js/i18n-runtime-extensions/paths');
    const config = {
      languages: ['en', 'cs'],
      localisedUrls: { '/about': { en: '/about', cs: '/o-nas' } },
    };
    for (const paths of [cjs, esm]) {
      expect(paths.localizePath('/about?q=1#x', 'cs', config)).toBe(
        '/cs/o-nas?q=1#x',
      );
      expect(paths.canonicalPath('/cs/o-nas?q=1#x', config)).toBe(
        '/about?q=1#x',
      );
      expect(
        paths.buildLocalizedUrl(
          '/about?q=1#x',
          'cs',
          config.languages,
          config.localisedUrls,
        ),
      ).toBe('/cs/o-nas?q=1#x');
    }
  });
});

test('native public consumers retain components and hooks while pure mapped imports have migrated', () => {
  for (const entry of [
    '@modern-js/plugin-i18n/runtime',
    '@modern-js/plugin-i18n/runtime/no-react-i18next',
  ]) {
    const native = require(entry);
    for (const name of [
      'Link',
      'I18nLink',
      'useLocalizedPaths',
      'useLocalizedLocation',
    ]) {
      expect(typeof native[name]).toBe('function');
    }
    for (const name of ['localizePath', 'canonicalPath', 'buildLocalizedUrl']) {
      expect(Object.hasOwn(native, name)).toBe(false);
    }
  }
});

test('public integrated option types accept maps and reject invalid locale values', () => {
  const directory = mkdtempSync(
    resolve(packageDirectory, '.options-type-test-'),
  );
  try {
    const fixture = resolve(directory, 'consumer.mts');
    writeFileSync(
      fixture,
      `
import type { I18nPluginOptions, I18nServerPluginOptions } from '@modern-js/i18n-integration/options';
import { i18nPlugin } from '@modern-js/i18n-integration/runtime';
import { i18nPlugin as nativeCli } from '@modern-js/plugin-i18n/cli';
import type { I18nPluginOptions as NativeOptions } from '@modern-js/plugin-i18n/runtime/no-react-i18next';
import { localizePath, canonicalPath, buildLocalizedUrl } from '@modern-js/i18n-runtime-extensions/paths';
// @ts-expect-error mapped pure helpers moved to their owning package
import { localizePath as oldLocalizePath } from '@modern-js/plugin-i18n/runtime';
const valid: I18nPluginOptions = {
  localeDetection: {
    languages: ['en', 'cs'],
    localisedUrls: { '/about': { en: '/about', cs: '/o-nas' } },
    localeDetectionByEntry: { admin: { localisedUrls: { '/about': { en: '/about', cs: '/sprava' } } } },
  },
};
i18nPlugin(valid);
nativeCli({ localeDetection: valid.localeDetection });
const invalid: I18nPluginOptions = { localeDetection: {
  // @ts-expect-error arbitrary strings are not locale map options
  localisedUrls: 'unknown-mode',
} };
const invalidPath: I18nServerPluginOptions = { staticRoutePrefixes: [], localeDetection: {
  // @ts-expect-error translated path values must be strings
  localisedUrls: { '/about': { cs: 123 } },
} };
const native: NativeOptions = { localeDetection: {
  // @ts-expect-error native options do not declare the fork map schema
  localisedUrls: { '/about': { cs: '/o-nas' } },
} };
const config = { languages: ['en', 'cs'], localisedUrls: { '/about': { en: '/about', cs: '/o-nas' } } };
localizePath('/about', 'cs', config);
canonicalPath('/cs/o-nas', config);
buildLocalizedUrl('/about', 'cs', config.languages, config.localisedUrls);
`,
    );
    const compilerPackage = require.resolve(
      '@typescript/native-preview/package.json',
    );
    const compilerMetadata = require(compilerPackage) as {
      bin: string | { tsgo: string };
    };
    const compilerEntry =
      typeof compilerMetadata.bin === 'string'
        ? compilerMetadata.bin
        : compilerMetadata.bin.tsgo;
    const compiler = resolve(compilerPackage, '..', compilerEntry);
    try {
      execFileSync(
        process.execPath,
        [
          compiler,
          '--ignoreConfig',
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--module',
          'NodeNext',
          '--moduleResolution',
          'NodeNext',
          '--target',
          'ES2022',
          fixture,
        ],
        { cwd: packageDirectory, stdio: 'pipe' },
      );
    } catch (error: any) {
      throw new Error(
        `Public option type-check failed: ${error.stdout ?? ''} ${error.stderr ?? ''}`,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
