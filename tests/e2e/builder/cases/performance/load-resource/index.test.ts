import { expect, test } from '@playwright/test';
import { build } from '@scripts/shared';
import { join } from 'path';

const fixtures = __dirname;

const getAttribute = (tag: string, name: string): string | null => {
  const match = new RegExp(
    `(?:^|\\s)${name}\\b(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`,
    'i',
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
};

const getResourceLinks = (
  files: Record<string, string>,
  rel: 'prefetch' | 'preload',
) => {
  const html = Object.entries(files).find(([name]) =>
    name.endsWith('index.html'),
  )?.[1];
  expect(html).toBeDefined();
  return [...(html ?? '').matchAll(/<link\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => getAttribute(tag, 'rel') === rel)
    .map(tag => ({
      as: getAttribute(tag, 'as'),
      crossOrigin: getAttribute(tag, 'crossorigin'),
      href: getAttribute(tag, 'href'),
    }));
};

test('should generate prefetch link when prefetch is defined', async () => {
  const builder = await build({
    cwd: fixtures,
    entry: {
      main: join(fixtures, 'src/page1/index.ts'),
    },
    builderConfig: {
      output: {
        assetPrefix: 'https://www.foo.com',
      },
      performance: {
        prefetch: true,
      },
    },
  });

  const files = await builder.unwrapOutputJSON();

  const asyncFileName = Object.keys(files).find(file =>
    file.includes('/static/js/async/'),
  )!;
  const links = getResourceLinks(files, 'prefetch');

  expect(links).toHaveLength(3);
  expect(links).toContainEqual({
    as: null,
    crossOrigin: null,
    href: `https://www.foo.com${asyncFileName.slice(
      asyncFileName.indexOf('/static/js/async/'),
    )}`,
  });
});

test('should generate prefetch link correctly when assetPrefix do not have a protocol', async () => {
  const builder = await build({
    cwd: fixtures,
    entry: {
      main: join(fixtures, 'src/page1/index.ts'),
    },
    builderConfig: {
      output: {
        assetPrefix: '//www.foo.com',
      },
      performance: {
        prefetch: true,
      },
    },
  });

  const files = await builder.unwrapOutputJSON();

  const asyncFileName = Object.keys(files).find(file =>
    file.includes('/static/js/async/'),
  )!;
  const links = getResourceLinks(files, 'prefetch');

  expect(links).toContainEqual({
    as: null,
    crossOrigin: null,
    href: `//www.foo.com${asyncFileName.slice(
      asyncFileName.indexOf('/static/js/async/'),
    )}`,
  });
});

test('should generate prefetch link with filter', async () => {
  const builder = await build({
    cwd: fixtures,
    entry: {
      main: join(fixtures, 'src/page1/index.ts'),
    },
    builderConfig: {
      performance: {
        prefetch: {
          include: [/.*\.png$/],
        },
      },
    },
  });

  const files = await builder.unwrapOutputJSON();

  const asyncFileName = Object.keys(files).find(file =>
    file.includes('/static/image/test'),
  )!;
  const links = getResourceLinks(files, 'prefetch');

  expect(links).toEqual([
    {
      as: null,
      crossOrigin: null,
      href: asyncFileName.slice(asyncFileName.indexOf('/static/image/test')),
    },
  ]);
});

test('should generate preload link when preload is defined', async () => {
  const builder = await build({
    cwd: fixtures,
    entry: {
      main: join(fixtures, 'src/page1/index.ts'),
    },
    builderConfig: {
      performance: {
        preload: true,
      },
    },
  });

  const files = await builder.unwrapOutputJSON();

  const asyncFileName = Object.keys(files).find(file =>
    file.includes('/static/js/async/'),
  )!;
  const links = getResourceLinks(files, 'preload');

  expect(links).toHaveLength(3);
  expect(links).toContainEqual({
    as: 'script',
    crossOrigin: null,
    href: asyncFileName.slice(asyncFileName.indexOf('/static/js/async/')),
  });
});

test('should generate preload link with crossOrigin', async () => {
  const builder = await build({
    cwd: fixtures,
    entry: {
      main: join(fixtures, 'src/page1/index.ts'),
    },
    builderConfig: {
      html: {
        crossorigin: 'anonymous',
      },
      output: {
        assetPrefix: '//aaa.com',
      },
      performance: {
        preload: true,
      },
    },
  });

  const files = await builder.unwrapOutputJSON();

  const asyncFileName = Object.keys(files).find(file =>
    file.includes('/static/js/async/'),
  )!;
  const links = getResourceLinks(files, 'preload');

  expect(links).toHaveLength(3);
  expect(links).toContainEqual({
    as: 'script',
    crossOrigin: '',
    href: `//aaa.com${asyncFileName.slice(
      asyncFileName.indexOf('/static/js/async/'),
    )}`,
  });
});

test('should generate preload link without crossOrigin when same origin', async () => {
  const builder = await build({
    cwd: fixtures,
    entry: {
      main: join(fixtures, 'src/page1/index.ts'),
    },
    builderConfig: {
      html: {
        crossorigin: 'anonymous',
      },
      performance: {
        preload: true,
      },
    },
  });

  const files = await builder.unwrapOutputJSON();

  const asyncFileName = Object.keys(files).find(file =>
    file.includes('/static/js/async/'),
  )!;
  const links = getResourceLinks(files, 'preload');

  expect(links).toHaveLength(3);
  expect(links).toContainEqual({
    as: 'script',
    crossOrigin: null,
    href: asyncFileName.slice(asyncFileName.indexOf('/static/js/async/')),
  });
});
