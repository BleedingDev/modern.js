import { createPluginManager } from '@modern-js/plugin';
import {
  createRuntimeContext,
  initPluginAPI,
  type RuntimePluginAPI,
} from '@modern-js/plugin/runtime';
import React, { useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.edge';
import {
  getGlobalEnableRsc,
  getGlobalInternalRuntimeContext,
  getInitialContext,
  InternalRuntimeContext,
  RuntimeContext,
  setGlobalContext,
  setGlobalInternalRuntimeContext,
} from '../../../src/core/context';
import { RuntimeComponentResolverContext } from '../../../src/core/context/runtime';
import type { RuntimeExtends } from '../../../src/core/plugin/types';
import { wrapRuntimeContextProvider } from '../../../src/core/react/wrapper';

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

      expect(element.type).toBe(RuntimeComponentResolverContext.Provider);
      const internal = element.props.children;
      expect(internal.type).toBe(InternalRuntimeContext.Provider);
      expect(internal.props.children.type).toBe(RuntimeContext.Provider);
      expect(internal.props.children.props.children).toBe(app);
      expect(renderToString(element)).toBe('<p>native context</p>');
    });

    it('pipelines both values before rendering while keeping the original context stable', () => {
      const privateKey = Symbol('private-plugin-data');
      const privateValue = { request: 'original' };
      const context = Object.assign(getInitialContext(false), {
        [privateKey]: privateValue,
      });
      const order: string[] = [];
      api.transformRuntimeContext((projection, options) => {
        order.push('first');
        expect(options.context).toBe(context);
        expect(options.isRsc).toBe(false);
        expect(projection.internalContext).toBe(context);
        const publicContext = { ...projection.publicContext, label: 'first' };
        Reflect.deleteProperty(publicContext, privateKey);
        return {
          internalContext: { ...projection.internalContext, step: 'first' },
          publicContext,
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
      expect(context[privateKey]).toBe(privateValue);
    });

    it('provides RSC mode and the original context without putting a resolver into the Flight tree', () => {
      setGlobalContext({ enableRsc: true });
      const context = getInitialContext(false);
      context.ssrContext = {
        request: { ...context.requestContext.request, pathname: '/tractors' },
        response: { setHeader: rstest.fn(), status: rstest.fn(), locals: {} },
      };
      const transport = context.ssrContext;
      let calls = 0;
      api.transformRuntimeContext((projection, options) => {
        calls += 1;
        expect(options.context).toBe(context);
        expect(options.isRsc).toBe(true);
        expect(projection.internalContext).toBe(context);
        const internalContext = { ...projection.internalContext };
        delete internalContext.ssrContext;
        return { ...projection, internalContext };
      });
      const app = <p>RSC context</p>;
      const element = wrapRuntimeContextProvider(app, context);

      expect(element.type).toBe(InternalRuntimeContext.Provider);
      expect(element.props.children.type).toBe(RuntimeContext.Provider);
      expect(element.props.children.props.children).toBe(app);
      expect(element.props.value.ssrContext).toBeUndefined();
      expect(renderToString(element)).toBe('<p>RSC context</p>');
      expect(calls).toBe(1);
      expect(context.ssrContext).toBe(transport);
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
});
