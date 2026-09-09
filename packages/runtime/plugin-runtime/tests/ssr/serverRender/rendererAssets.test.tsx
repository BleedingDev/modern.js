import { initHooks } from '@modern-js/plugin/runtime';
import React from 'react';
import { RenderLevel } from '../../../src/core/constants';
import {
  getInitialContext,
  setGlobalContext,
  setGlobalInternalRuntimeContext,
} from '../../../src/core/context';
import {
  CHUNK_CSS_PLACEHOLDER,
  SSR_DATA_PLACEHOLDER,
} from '../../../src/core/server/constants';
import { createSSRRenderLifecycle } from '../../../src/core/server/shared';
import { getTemplates } from '../../../src/core/server/stream/template';
import { renderString } from '../../../src/core/server/string';
import { SSRDataCollector } from '../../../src/core/server/string/ssrData';

const runtimeContext = () =>
  Object.assign(getInitialContext(false), {
    initialData: {},
    __i18nData__: {},
    ssrContext: {
      request: {
        params: {},
        query: {},
        pathname: '/',
        host: 'localhost',
        url: 'http://localhost/',
        headers: {},
      },
      reporter: { sessionId: 'test' },
    },
  });

test('asset transforms preserve subtype identity and original groups across observers', () => {
  const first = { url: '/one.css', integrity: { token: 1 } };
  const second = { url: '/two.css', integrity: { token: 2 } };
  const groups = [
    { name: 'entry', assets: [first] },
    { name: 'collected', assets: [second] },
  ];
  const lifecycle = createSSRRenderLifecycle([
    {
      transformAssets(assets, info) {
        expect(info.groups).toBe(groups);
        expect(assets[0]).toBe(first);
        return [assets[1], assets[0]];
      },
    },
    {
      transformAssets(assets, info) {
        expect(info.groups).toBe(groups);
        expect(assets[0]).toBe(second);
        return [...assets, info.createAsset('/three.css')];
      },
    },
  ]);
  const result = lifecycle.transformAssets(groups, {
    source: 'template',
    kind: 'style',
    template: '',
    createAsset: url => ({ url, integrity: { token: 3 } }),
  });
  expect(result[0]).toBe(second);
  expect(result[1]).toBe(first);
  expect(result[2].integrity.token).toBe(3);
});

test('string template callbacks receive original metadata after asynchronous effects', async () => {
  setGlobalContext({ enableRsc: false });
  const hooks = initHooks<{}, ReturnType<typeof getInitialContext>>();
  setGlobalInternalRuntimeContext({ hooks });
  const resource = {
    entryName: 'main',
    routeManifest: {},
    htmlTemplate: `<html><head>${CHUNK_CSS_PLACEHOLDER}</head><body><!--<?- html ?>-->${SSR_DATA_PLACEHOLDER}</body></html>`,
  };
  const config = { nonce: 'x"&' };
  const context = runtimeContext();
  let effectComplete = false;
  const names: string[] = [];
  hooks.extendStringSSRCollectors.tap(({ render, chunkSet }) => {
    expect(render.resource).toBe(resource);
    expect(render.config).toBe(config);
    expect(render.runtimeContext).toBe(context);
    return {
      async effect() {
        await Promise.resolve();
        effectComplete = true;
        chunkSet.cssChunk += '<style>effect</style>';
      },
      transformTemplateChunk(chunk, formatting) {
        expect(effectComplete).toBe(true);
        names.push(chunk.name);
        if (chunk.name !== 'styles') return chunk;
        expect(chunk.content).toContain('<style>effect</style>');
        expect(
          formatting.hasStylesheetLink(
            '<link href="/a.css" rel="stylesheet">',
            '/a.css',
          ),
        ).toBe(true);
        return {
          ...chunk,
          content:
            chunk.content +
            `<link${formatting.attributesToString({ nonce: config.nonce, href: '/a.css' })}>`,
        };
      },
    };
  });
  const onError = rs.fn();
  const html = await renderString(
    new Request('http://localhost/'),
    <main>body</main>,
    {
      resource,
      config,
      runtimeContext: context,
      onError,
      onTiming() {},
    } as any,
  );
  expect(onError).not.toHaveBeenCalled();
  expect(html).toContain('<style>effect</style>');
  expect(html).toContain('nonce="x&quot;&amp;"');
  expect(names).toEqual(['scripts', 'styles', 'data']);
});

test('stream template callbacks can relocate completed data before the HTML separator', async () => {
  const seen: string[] = [];
  const lifecycle = createSSRRenderLifecycle([
    {
      transformTemplateChunk(chunk) {
        seen.push(chunk.name);
        if (chunk.name !== 'data') return chunk;
        expect(chunk.template).toContain('<!--<?- html ?>-->');
        return {
          ...chunk,
          template: chunk.template.replace('<head>', `<head>${chunk.content}`),
          content: '',
        };
      },
    },
  ]);
  const { shellBefore, shellAfter } = await getTemplates(
    `<html><head></head><body><!--<?- html ?>-->${SSR_DATA_PLACEHOLDER}</body></html>`,
    {
      lifecycle,
      entryName: 'main',
      runtimeContext: runtimeContext(),
      config: {},
      ssrConfig: {},
      renderLevel: RenderLevel.SERVER_RENDER,
      request: new Request('http://localhost/'),
    } as any,
  );
  expect(shellBefore).toContain('window._SSR_DATA =');
  expect(shellAfter).not.toContain('window._SSR_DATA =');
  expect(shellAfter).not.toContain(SSR_DATA_PLACEHOLDER);
  expect(seen).toEqual(['scripts', 'data', 'styles']);
});

test.each([
  true,
  false,
])('raw router supplier keeps native error serialization and empty-object precedence (%s)', empty => {
  const context = runtimeContext();
  const chunkSet = {
    renderLevel: RenderLevel.SERVER_RENDER,
    ssrScripts: '',
    jsChunk: '',
    cssChunk: '',
  };
  const data = empty
    ? {}
    : { loaderData: { custom: true }, errors: { custom: new Error('failed') } };
  const lifecycle = createSSRRenderLifecycle([
    { getRouterData: () => data },
    { getRouterData: () => undefined },
  ]);
  const collector = new SSRDataCollector({
    runtimeContext: context,
    request: new Request('http://localhost/'),
    ssrContext: context.ssrContext as any,
    chunkSet,
    lifecycle,
    routerContext: { loaderData: { fallback: true }, errors: null } as any,
  });
  collector.effect();
  expect(chunkSet.ssrScripts).toContain('window._ROUTER_DATA =');
  expect(chunkSet.ssrScripts).not.toContain('fallback');
  if (empty) expect(chunkSet.ssrScripts).toContain('"errors":null');
  else {
    expect(chunkSet.ssrScripts).toContain('"message":"failed"');
    expect(chunkSet.ssrScripts).toContain('"__type":"Error"');
  }
});

test('an absent router supplier retains the native router context fallback', () => {
  const context = runtimeContext();
  const chunkSet = {
    renderLevel: RenderLevel.SERVER_RENDER,
    ssrScripts: '',
    jsChunk: '',
    cssChunk: '',
  };
  const collector = new SSRDataCollector({
    runtimeContext: context,
    request: new Request('http://localhost/'),
    ssrContext: context.ssrContext as any,
    chunkSet,
    lifecycle: createSSRRenderLifecycle([{ getRouterData: () => undefined }]),
    routerContext: { loaderData: { fallback: true }, errors: null } as any,
  });
  collector.effect();
  expect(chunkSet.ssrScripts).toContain('"loaderData":{"fallback":true}');
});
