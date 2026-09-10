import { expect, test } from '@playwright/test';
import { build, getHrefByEntryName } from '@scripts/shared';
import { join, resolve } from 'path';

const fixtures = __dirname;

const getAttribute = (tag: string, name: string): string | null => {
  const match = new RegExp(
    `(?:^|\\s)${name}\\b(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`,
    'i',
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
};

const getLinks = (
  files: Record<string, string>,
  rel: 'dns-prefetch' | 'preconnect',
) => {
  const html = Object.entries(files).find(([name]) =>
    name.endsWith('index.html'),
  )?.[1];
  expect(html).toBeDefined();
  return [...(html ?? '').matchAll(/<link\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => getAttribute(tag, 'rel') === rel)
    .map(tag => ({
      crossOrigin: getAttribute(tag, 'crossorigin'),
      href: getAttribute(tag, 'href'),
    }));
};

test.describe('performance configure multi', () => {
  let files: Record<string, string>;
  const basicFixtures = resolve(__dirname, 'basic');

  test.beforeAll(async () => {
    const builder = await build({
      cwd: basicFixtures,
      entry: {
        main: join(basicFixtures, 'src/index.ts'),
      },
      builderConfig: {
        splitChunks: false,
      },
    });

    files = await builder.unwrapOutputJSON();
  });

  test('Disable split chunks', async () => {
    // expect only one bundle (end with .js)
    const filePaths = Object.keys(files).filter(file => file.endsWith('.js'));

    expect(filePaths.length).toBe(1);
  });
});

test('should generate and execute a vendor chunk when splitChunks.preset is "single-vendor"', async ({
  page,
}) => {
  const builder = await build({
    cwd: join(fixtures, 'basic'),
    entry: {
      main: join(fixtures, 'basic/src/index.ts'),
    },
    builderConfig: {
      splitChunks: {
        preset: 'single-vendor',
      },
    },
    runServer: true,
  });

  const files = await builder.unwrapOutputJSON();

  const vendorFile = Object.keys(files).find(
    name => name.includes('vendor') && name.endsWith('.js'),
  );

  expect(vendorFile).toBeTruthy();
  await page.goto(getHrefByEntryName('main', builder.port));
  await expect(page.locator('#test')).toHaveText('Hello Builder!');
  builder.close();
});

test('should generate preconnect link when preconnect is defined', async () => {
  const builder = await build({
    cwd: join(fixtures, 'basic'),
    entry: {
      main: join(fixtures, 'basic/src/index.ts'),
    },
    builderConfig: {
      performance: {
        preconnect: [
          {
            href: 'http://aaaa.com',
          },
          {
            href: 'http://bbbb.com',
            crossorigin: true,
          },
        ],
      },
    },
  });

  const files = await builder.unwrapOutputJSON();
  const links = getLinks(files, 'preconnect');

  expect(links).toEqual([
    { crossOrigin: null, href: 'http://aaaa.com' },
    { crossOrigin: '', href: 'http://bbbb.com' },
  ]);
});

test('should generate dnsPrefetch link when dnsPrefetch is defined', async () => {
  const builder = await build({
    cwd: join(fixtures, 'basic'),
    entry: {
      main: join(fixtures, 'basic/src/index.ts'),
    },
    builderConfig: {
      performance: {
        dnsPrefetch: ['http://aaaa.com'],
      },
    },
  });

  const files = await builder.unwrapOutputJSON();
  const links = getLinks(files, 'dns-prefetch');

  expect(links).toEqual([{ crossOrigin: null, href: 'http://aaaa.com' }]);
});
