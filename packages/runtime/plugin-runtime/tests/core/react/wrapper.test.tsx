import { createPluginManager } from '@modern-js/plugin';
import {
  createRuntimeContext,
  initPluginAPI,
  type RuntimePluginAPI,
} from '@modern-js/plugin/runtime';
import React, { useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.edge';
import { HelmetProvider } from 'react-helmet-async';
import {
  applyRouterRuntimeState,
  getGlobalEnableRsc,
  getGlobalInternalRuntimeContext,
  getInitialContext,
  getRouterRuntimeState,
  getRouterServerSnapshot,
  InternalRuntimeContext,
  RuntimeContext,
  setGlobalContext,
  setGlobalInternalRuntimeContext,
} from '../../../src/core/context';
import { getHelmetContext } from '../../../src/core/context/helmetContext';
import type { RuntimeExtends } from '../../../src/core/plugin/types';
import { wrapRuntimeContextProvider } from '../../../src/core/react/wrapper';
import { Helmet } from '../../../src/exports/head';

describe('wrapRuntimeContextProvider', () => {
  describe('native context projection', () => {
    let api: RuntimePluginAPI<RuntimeExtends>;
    let previousRuntime: ReturnType<typeof getGlobalInternalRuntimeContext>;
    let previousRsc: ReturnType<typeof getGlobalEnableRsc>;

    beforeEach(() => {
      previousRuntime = getGlobalInternalRuntimeContext();
      previousRsc = getGlobalEnableRsc();
      const runtime = createRuntimeContext<RuntimeExtends>({
        runtimeContext: getInitialContext(false),
        config: {},
        plugins: [],
      });
      setGlobalInternalRuntimeContext(runtime);
      setGlobalContext({ enableRsc: false });
      api = initPluginAPI<RuntimeExtends>({
        context: runtime,
        pluginManager: createPluginManager(),
        plugins: [],
      });
    });

    afterEach(() => {
      setGlobalInternalRuntimeContext(previousRuntime);
      setGlobalContext({ enableRsc: previousRsc });
    });

    it('preserves default values and the single provider pair without callbacks', () => {
      const context = getInitialContext(false);
      const Probe = () => {
        expect(useContext(InternalRuntimeContext)).toBe(context);
        const publicValue = useContext(RuntimeContext);
        expect(publicValue).not.toBe(context);
        expect(publicValue.requestContext).toBe(context.requestContext);
        return <p>native context</p>;
      };
      const app = <Probe />;
      const element = wrapRuntimeContextProvider(app, context);

      expect(element.type).toBe(InternalRuntimeContext.Provider);
      expect(element.props.children.type).toBe(RuntimeContext.Provider);
      const helmet = element.props.children.props.children;
      expect(helmet.type).toBe(HelmetProvider);
      expect(helmet.props.children).toBe(app);
      expect(renderToString(element)).toBe('<p>native context</p>');
    });

    it('pipelines both values before rendering while keeping the original context stable', () => {
      const context = getInitialContext(false);
      applyRouterRuntimeState(context, {
        framework: 'custom-router',
        instance: { kind: 'internal-router' },
      });
      const order: string[] = [];
      api.transformRuntimeContext((projection, options) => {
        order.push('first');
        expect(options.context).toBe(context);
        expect(options.isRsc).toBe(false);
        expect(projection.internalContext).toBe(context);
        expect(getRouterRuntimeState(projection.publicContext)).toBeUndefined();
        return {
          internalContext: { ...projection.internalContext, step: 'first' },
          publicContext: { ...projection.publicContext, label: 'first' },
        };
      });
      api.transformRuntimeContext((projection, options) => {
        order.push('second');
        expect(options.context).toBe(context);
        expect(projection.internalContext).not.toBe(context);
        expect(projection.internalContext.step).toBe('first');
        expect(projection.publicContext.label).toBe('first');
        return {
          ...projection,
          publicContext: { ...projection.publicContext, label: 'second' },
        };
      });
      const Probe = () => {
        order.push('render');
        expect(useContext(InternalRuntimeContext).step).toBe('first');
        expect(useContext(RuntimeContext).label).toBe('second');
        return null;
      };

      renderToString(wrapRuntimeContextProvider(<Probe />, context));

      expect(order).toEqual(['first', 'second', 'render']);
      expect(context.step).toBeUndefined();
      expect(context.label).toBeUndefined();
      expect(getRouterRuntimeState(context)?.instance).toEqual({
        kind: 'internal-router',
      });
    });

    it('passes the default RSC projections and the original response to callbacks separately', () => {
      setGlobalContext({ enableRsc: true });
      const context = getInitialContext(false);
      const response = {
        setHeader: rstest.fn(),
        status: rstest.fn(),
        locals: { tenant: 'tractor-store' },
      };
      context.ssrContext = {
        request: { ...context.requestContext.request, pathname: '/tractors' },
        response,
      };
      applyRouterRuntimeState(context, { framework: 'custom-router' });
      let calls = 0;
      api.transformRuntimeContext((projection, options) => {
        calls += 1;
        expect(options.context).toBe(context);
        expect(options.context.ssrContext?.response).toBe(response);
        expect(options.isRsc).toBe(true);
        expect(projection.internalContext).not.toBe(context);
        expect(projection.internalContext.ssrContext).toBeUndefined();
        expect(projection.publicContext.ssrContext).toBeUndefined();
        expect(projection.internalContext.requestContext).toBe(
          projection.publicContext.requestContext,
        );
        expect(projection.internalContext.context).toBe(
          projection.internalContext.requestContext,
        );
        expect(projection.publicContext.requestContext.response.locals).toBe(
          response.locals,
        );
        expect(
          Object.keys(projection.publicContext.requestContext.response),
        ).toEqual(['locals']);
        // Keep the current internal RSC state contract until serialization is
        // separately tested; public context must still exclude the private slot.
        expect(
          getRouterRuntimeState(projection.internalContext)?.framework,
        ).toBe('custom-router');
        expect(getRouterRuntimeState(projection.publicContext)).toBeUndefined();
        return projection;
      });
      const app = <p>RSC context</p>;
      const element = wrapRuntimeContextProvider(app, context);

      expect(element.type).toBe(InternalRuntimeContext.Provider);
      expect(element.props.children.type).toBe(RuntimeContext.Provider);
      expect(element.props.children.props.children).toBe(app);
      expect(renderToString(element)).toBe('<p>RSC context</p>');
      expect(calls).toBe(1);
      expect(context.ssrContext.response).toBe(response);
      expect(Object.keys(response)).toEqual(['setHeader', 'status', 'locals']);
    });

    it('propagates callback failures before exposing a partially projected tree', () => {
      const context = getInitialContext(false);
      const error = new Error('projection rejected');
      const render = rstest.fn(() => null);
      api.transformRuntimeContext(projection => ({
        ...projection,
        publicContext: { ...projection.publicContext, label: 'partial' },
      }));
      api.transformRuntimeContext(() => {
        throw error;
      });
      const afterFailure = rstest.fn(projection => projection);
      api.transformRuntimeContext(afterFailure);
      const Probe = render;

      expect(() => wrapRuntimeContextProvider(<Probe />, context)).toThrow(
        error,
      );
      expect(afterFailure).not.toHaveBeenCalled();
      expect(render).not.toHaveBeenCalled();
      expect(context.label).toBeUndefined();
    });

    it('keeps projected values isolated across concurrent suspended renders', async () => {
      api.transformRuntimeContext((projection, options) => ({
        ...projection,
        publicContext: {
          ...projection.publicContext,
          label: `projected:${String(options.context.requestId)}`,
        },
      }));
      const Probe = ({ ready }: { ready: Promise<void> }) => {
        React.use(ready);
        const internal = useContext(InternalRuntimeContext);
        const publicValue = useContext(RuntimeContext);
        return (
          <p>{`${String(internal.requestId)}:${String(publicValue.label)}`}</p>
        );
      };
      const requests = ['first', 'second'].map(requestId => {
        let release = () => {};
        const ready = new Promise<void>(resolve => {
          release = resolve;
        });
        const context = Object.assign(getInitialContext(false), { requestId });
        return { context, ready, release };
      });
      const streams = await Promise.all(
        requests.map(({ context, ready }) =>
          renderToReadableStream(
            wrapRuntimeContextProvider(
              <React.Suspense fallback={<span>pending</span>}>
                <Probe ready={ready} />
              </React.Suspense>,
              context,
            ),
          ),
        ),
      );
      requests[1].release();
      requests[0].release();
      const html = await Promise.all(
        streams.map(async stream => {
          await stream.allReady;
          return new Response(stream).text();
        }),
      );

      expect(html[0]).toContain('<p>first:projected:first</p>');
      expect(html[0]).not.toContain('projected:second');
      expect(html[1]).toContain('<p>second:projected:second</p>');
      expect(html[1]).not.toContain('projected:first');
      for (const { context } of requests) {
        expect(context.label).toBeUndefined();
      }
    });
  });

  it('should keep router runtime state out of public context enumeration', () => {
    let runtimeValue: Record<string, unknown> | undefined;
    let internalValue: Record<string, unknown> | undefined;

    const Probe = () => {
      runtimeValue = useContext(RuntimeContext) as Record<string, unknown>;
      internalValue = useContext(InternalRuntimeContext) as Record<
        string,
        unknown
      >;
      return null;
    };

    const context = getInitialContext(false);
    applyRouterRuntimeState(context, {
      framework: 'custom-router',
      instance: { kind: 'internal-router' },
      serverSnapshot: {
        matchedRouteIds: ['route-a'],
      },
    });

    renderToString(
      wrapRuntimeContextProvider(
        <Probe />,
        context as Record<string, unknown> as any,
      ),
    );

    expect(getRouterServerSnapshot(internalValue as object)).toMatchObject({
      matchedRouteIds: ['route-a'],
    });
    expect(getRouterRuntimeState(internalValue as object)?.framework).toBe(
      'custom-router',
    );
    expect(getRouterRuntimeState(internalValue as object)?.instance).toEqual({
      kind: 'internal-router',
    });

    // None of the router state may leak into string-key enumeration of
    // either context value — each forbidden key is asserted individually so
    // a partial leak fails too.
    const forbiddenKeys = [
      'routerFramework',
      'routerInstance',
      'routerRuntime',
      'routerServerSnapshot',
      'routerHydrationScript',
      'routerMatchedRouteIds',
      '_helmetContext',
    ];
    for (const value of [runtimeValue, internalValue]) {
      const keys = Object.keys(value as object);
      for (const forbidden of forbiddenKeys) {
        expect(keys).not.toContain(forbidden);
      }
    }
    expect(runtimeValue?.routerFramework).toBeUndefined();
    expect(runtimeValue?.routerInstance).toBeUndefined();
    expect(runtimeValue?.routerServerSnapshot).toBeUndefined();

    // The symbol-keyed extension slot must not be reachable from the PUBLIC
    // context object either: spreads copy enumerable symbol properties, so
    // the wrapper has to strip the slot from the public copy.
    const extensionsSlot = Symbol.for('@modern-js/runtime:context-extensions');
    expect(Object.getOwnPropertySymbols(runtimeValue as object)).not.toContain(
      extensionsSlot,
    );
    expect(getRouterRuntimeState(runtimeValue as object)).toBeUndefined();
    expect(getRouterServerSnapshot(runtimeValue as object)).toBeUndefined();

    // ...while the internal context keeps carrying it.
    expect(Object.getOwnPropertySymbols(internalValue as object)).toContain(
      extensionsSlot,
    );
  });

  it('should collect head tags in an isolated request context', () => {
    const context = getInitialContext(false);

    renderToString(
      wrapRuntimeContextProvider(
        <Helmet htmlAttributes={{ lang: 'cs' }}>
          <title>Modern SSR</title>
        </Helmet>,
        context as Record<string, unknown> as any,
      ),
    );

    expect(getHelmetContext(context)?.helmet?.htmlAttributes.toString()).toBe(
      'lang="cs"',
    );
    expect(getHelmetContext(context)?.helmet?.title.toString()).toBe(
      '<title data-rh="true">Modern SSR</title>',
    );
  });

  it('keeps response functions outside the RSC internal context', () => {
    let internalValue: ReturnType<typeof getInitialContext> | undefined;

    const Probe = () => {
      internalValue = useContext(InternalRuntimeContext);
      return null;
    };

    const response = {
      setHeader: rstest.fn(),
      status: rstest.fn(),
      locals: { tenant: 'tractor-store' },
    };
    const context = getInitialContext(false);
    context.ssrContext = {
      request: {
        params: { category: 'compact' },
        pathname: '/tractors',
        query: { sort: 'price' },
        headers: { accept: 'text/html' },
        host: 'example.test',
        url: 'https://example.test/tractors?sort=price',
      },
      response,
    };

    setGlobalContext({ enableRsc: true });
    try {
      renderToString(wrapRuntimeContextProvider(<Probe />, context));
    } finally {
      setGlobalContext({ enableRsc: false });
    }

    expect(internalValue?.ssrContext).toBeUndefined();
    expect(internalValue?.requestContext.request).toEqual({
      params: { category: 'compact' },
      pathname: '/tractors',
      query: { sort: 'price' },
      headers: { accept: 'text/html' },
      host: 'example.test',
      url: 'https://example.test/tractors?sort=price',
      userAgent: undefined,
      cookie: undefined,
      referer: undefined,
    });
    expect(internalValue?.requestContext.response).toEqual({
      locals: response.locals,
    });
    expect(
      Object.values(internalValue?.requestContext.response ?? {}).some(
        value => typeof value === 'function',
      ),
    ).toBe(false);
  });

  it('renders an RSC context without an SSR context', () => {
    let internalValue: ReturnType<typeof getInitialContext> | undefined;

    const Probe = () => {
      internalValue = useContext(InternalRuntimeContext);
      return <main>RSC request context</main>;
    };

    setGlobalContext({ enableRsc: true });
    try {
      const html = renderToString(
        wrapRuntimeContextProvider(<Probe />, getInitialContext(false)),
      );

      expect(html).toContain('RSC request context');
      expect(internalValue?.requestContext).toEqual({
        request: {
          params: {},
          pathname: '',
          query: {},
          headers: {},
          host: '',
          url: '',
        },
        response: { locals: {} },
      });
      expect(internalValue?.ssrContext).toBeUndefined();
    } finally {
      setGlobalContext({ enableRsc: false });
    }
  });

  it('serializes React head prop names to valid HTML attributes', () => {
    const context = getInitialContext(false);

    renderToString(
      wrapRuntimeContextProvider(
        <Helmet>
          <link href="/cs" hrefLang="cs" rel="alternate" />
          <meta charSet="utf-8" />
        </Helmet>,
        context as Record<string, unknown> as any,
      ),
    );

    expect(getHelmetContext(context)?.helmet?.link.toString()).toContain(
      '<link data-rh="true" href="/cs" hreflang="cs" rel="alternate">',
    );
    expect(getHelmetContext(context)?.helmet?.meta.toString()).toContain(
      '<meta data-rh="true" charset="utf-8">',
    );
  });
});
