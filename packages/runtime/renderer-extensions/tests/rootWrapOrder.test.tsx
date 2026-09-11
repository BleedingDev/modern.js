import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  getGlobalInternalRuntimeContext,
  setGlobalContext,
  setGlobalInternalRuntimeContext,
} from '../../plugin-runtime/src/core/context';
import { registerPlugin } from '../../plugin-runtime/src/core/plugin';
import rendererHeadPlugin, {
  RENDERER_HEAD_PRE_PLUGINS,
} from '../src/runtimePlugin';

const previousRuntime = getGlobalInternalRuntimeContext();

afterEach(() => {
  setGlobalInternalRuntimeContext(previousRuntime);
});

/** A stand-in for the router: it owns the root for a file-system routes entry. */
const routerLikePlugin = (content: React.ReactNode) => ({
  name: '@modern-js/plugin-router',
  setup(api: any) {
    api.wrapRoot((App: React.ComponentType<any> | undefined) => {
      const RouterWrapper = (props: any) =>
        App
          ? React.createElement(App, props, content)
          : React.createElement(React.Fragment, null, content);
      return RouterWrapper;
    });
  },
});

const renderRoot = () => {
  const hooks = getGlobalInternalRuntimeContext().hooks;
  // `App` is undefined for a routes entry until the router defines it.
  const Root = hooks.wrapRoot.call(undefined as any);
  return renderToString(React.createElement(Root));
};

describe('renderer head root wrapping', () => {
  beforeEach(() => {
    setGlobalContext({ enableRsc: false });
  });

  it('declares the runtime plugins it must wrap', () => {
    expect(RENDERER_HEAD_PRE_PLUGINS).toContain('@modern-js/plugin-router');
    expect(rendererHeadPlugin().pre).toEqual(RENDERER_HEAD_PRE_PLUGINS);
  });

  it('renders the router root when it is registered after the router', () => {
    registerPlugin([
      routerLikePlugin(React.createElement('main', null, 'routed')),
      rendererHeadPlugin(),
    ]);

    expect(renderRoot()).toContain('routed');
  });

  it('still renders when its descriptor is emitted before the router', () => {
    // The CLI appends the renderer descriptor first for a plain `appTools()`
    // app. Without an undefined-root fallback this threw
    // "Element type is invalid ... but got: undefined" during SSR.
    registerPlugin([
      rendererHeadPlugin(),
      routerLikePlugin(React.createElement('main', null, 'routed')),
    ]);

    expect(renderRoot()).toContain('routed');
  });
});
