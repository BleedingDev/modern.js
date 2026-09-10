import {
  createRouteHydrationScriptTags,
  getMatchedRouteChunks,
  injectBeforeHydrationEntryScript,
  orderHydrationScriptChunks,
  replaceChunkJsPlaceholder,
} from '../src/routeHydration';

const manifest = {
  routeAssets: {
    layout: { assets: ['/shared.js', '/layout.css'] },
    page: { assets: ['/page.js', '/shared.js'] },
    empty: {},
    missing: undefined,
    'async-main': { assets: ['/shared.js', '/async-main.hash.js'] },
  },
};

const tag = (src: string) => `<script src="${src}"></script>`;

describe('route hydration policy', () => {
  it('maps matched assets in route order without deduplicating or filtering', () => {
    const mapped = getMatchedRouteChunks(
      manifest,
      ['layout', 'unknown', 'empty', 'missing', 'page'],
      asset => ({ url: asset, marker: 'preserved' }),
    );
    expect(mapped).toEqual(
      ['/shared.js', '/layout.css', '/page.js', '/shared.js'].map(url => ({
        url,
        marker: 'preserved',
      })),
    );
  });

  it('returns no chunks for an explicit missing manifest or empty matches', () => {
    const toChunk = rstest.fn((url: string) => ({ url }));
    expect(getMatchedRouteChunks(undefined, ['page'], toChunk)).toEqual([]);
    expect(getMatchedRouteChunks({}, ['page'], toChunk)).toEqual([]);
    expect(getMatchedRouteChunks(manifest, [], toChunk)).toEqual([]);
    expect(toChunk).not.toHaveBeenCalled();
    expect(createRouteHydrationScriptTags(undefined, ['page'], 'main')).toBe(
      '',
    );
    expect(createRouteHydrationScriptTags({}, ['page'], 'main')).toBe('');
  });

  it('keeps dependencies, collected chunks and route chunks before async entry', () => {
    const dependency = { url: '/dependency.js', marker: 'dependency' };
    const collected = { url: '/collected.js', marker: 'collected' };
    const route = { url: '/route.js', marker: 'route' };
    const entry = { url: '/async-main.hash.js', marker: 'entry' };
    const asyncEntryChunks = [entry, dependency];
    const result = orderHydrationScriptChunks({
      asyncEntryChunks,
      collectedChunks: [collected, { ...dependency, marker: 'duplicate' }],
      matchedRouteChunks: [route, { url: '' }, {}, { ...collected }],
      entryName: 'main',
    });
    expect(result).toEqual([dependency, collected, route, entry]);
    expect(result[0]).toBe(dependency);
    expect(result[1]).toBe(collected);
    expect(asyncEntryChunks).toEqual([entry, dependency]);
  });

  it('classifies async entries using filename while retaining the JS URL rule', () => {
    const entry = { url: '/opaque.js', filename: 'nested/async-main-hash.js' };
    const queried = { url: '/async-main.js?hash=1' };
    const otherEntry = { url: '/async-other.js' };
    const asset = { url: '/async-main.css' };
    const route = { url: '/route.js' };
    expect(
      orderHydrationScriptChunks({
        asyncEntryChunks: [entry, queried, otherEntry, asset],
        collectedChunks: [],
        matchedRouteChunks: [route],
        entryName: 'main',
      }),
    ).toEqual([queried, otherEntry, asset, route, entry]);
  });

  it('serializes unique JS route assets then async assets and matches exact src', () => {
    expect(
      createRouteHydrationScriptTags(manifest, ['layout', 'page'], 'main', {
        template: `${tag('/page.js.map')}${tag('/shared.js')}`,
      }),
    ).toBe(`${tag('/page.js')} ${tag('/async-main.hash.js')}`);
    expect(createRouteHydrationScriptTags(manifest, [], 'main')).toBe(
      `${tag('/shared.js')} ${tag('/async-main.hash.js')}`,
    );
  });

  it('escapes asset and nonce attributes and omits empty nonce', () => {
    const unsafeManifest = {
      routeAssets: {
        page: { assets: ['/route" onload="alert(1)&x=<tag>.js'] },
      },
    };
    expect(
      createRouteHydrationScriptTags(unsafeManifest, ['page'], 'main', {
        nonce: 'nonce"&<value>',
      }),
    ).toBe(
      '<script src="/route&quot; onload=&quot;alert(1)&amp;x=&lt;tag&gt;.js" nonce="nonce&quot;&amp;&lt;value&gt;"></script>',
    );
    expect(
      createRouteHydrationScriptTags(manifest, ['page'], 'other', {
        nonce: '',
      }),
    ).toBe(`${tag('/page.js')} ${tag('/shared.js')}`);
  });

  it('prefers the main entry even when an async entry appears earlier', () => {
    const asyncEntry = tag('/async-main.hash.js');
    const entry =
      "<script defer src='/nested/main-hash.js?build=1#hash'></script>";
    const template = `${asyncEntry}${entry}`;
    expect(injectBeforeHydrationEntryScript(template, 'ROUTE', 'main')).toBe(
      `${asyncEntry}ROUTE${entry}`,
    );
  });

  it('falls back to async entry and preserves templates with no entry', () => {
    const asyncEntry = tag('/nested/async-main.js');
    expect(injectBeforeHydrationEntryScript(asyncEntry, 'ROUTE', 'main')).toBe(
      `ROUTE${asyncEntry}`,
    );
    expect(injectBeforeHydrationEntryScript(tag('/index.js'), 'ROUTE')).toBe(
      `ROUTE${tag('/index.js')}`,
    );
    const other = tag('/other-main.js');
    expect(injectBeforeHydrationEntryScript(other, 'ROUTE', 'main')).toBe(
      other,
    );
    expect(injectBeforeHydrationEntryScript(asyncEntry, '', 'main')).toBe(
      asyncEntry,
    );
  });

  it('moves placeholder scripts before hydration and replaces literal text safely', () => {
    const placeholder = '<!-- chunks -->';
    const scripts = '<script src="/$&-$`-$\'.js"></script>';
    const entry = tag('/main.js');
    expect(
      replaceChunkJsPlaceholder(
        `${entry}${placeholder}`,
        scripts,
        'main',
        placeholder,
      ),
    ).toBe(`${scripts}${entry}`);
    expect(
      replaceChunkJsPlaceholder(
        `before${placeholder}after`,
        scripts,
        'main',
        placeholder,
      ),
    ).toBe(`before${scripts}after`);
    expect(replaceChunkJsPlaceholder(entry, scripts, 'main', placeholder)).toBe(
      entry,
    );
    expect(
      replaceChunkJsPlaceholder(
        `${entry}${placeholder}`,
        '',
        'main',
        placeholder,
      ),
    ).toBe(entry);
    expect(
      replaceChunkJsPlaceholder(
        `${placeholder}${placeholder}`,
        '',
        undefined,
        placeholder,
      ),
    ).toBe(placeholder);
  });
});
