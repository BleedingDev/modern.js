import { ultramodernBoundaryDebuggerPlugin as exportedPlugin } from '@modern-js/boundary-debugger';
import React from 'react';
import ReactDomServer from 'react-dom/server';
import ultramodernBoundaryDebuggerPlugin from '../../src/boundary-debugger';

describe('ultramodern boundary debugger', () => {
  it('exports the same plugin through the fork-owned package subpath without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(exportedPlugin).toBe(ultramodernBoundaryDebuggerPlugin);
  });

  it('registers through the native runtime and preserves the application during SSR', () => {
    const { runtimeContext } = runtime.run({
      config: {},
      plugins: [
        exportedPlugin({
          enabledByDefault: true,
          metadata: { appId: 'shell', boundaries: [], schemaVersion: 1 },
        }),
      ],
    });
    const App = runtimeContext.hooks.wrapRoot.call(() => (
      <main>native app</main>
    ));
    expect(ReactDomServer.renderToString(<App />)).toBe(
      '<main>native app</main>',
    );
  });

  it('does not render debug controls during SSR', () => {
    let WrappedApp: React.ComponentType | undefined;
    const plugin = ultramodernBoundaryDebuggerPlugin({
      controlMode: 'visible',
      enabledByDefault: true,
      legacySelector: '[data-mf-remote]',
      metadata: {
        appId: 'shell',
        boundaries: [
          {
            appId: 'catalog',
            mfName: 'catalog',
          },
        ],
        schemaVersion: 1,
      },
    });

    plugin.setup?.({
      wrapRoot: (
        factory: (App: React.ComponentType) => React.ComponentType,
      ) => {
        WrappedApp = factory(() => <main>app</main>);
      },
    } as any);

    expect(WrappedApp).toBeDefined();
    const App = WrappedApp!;
    expect(ReactDomServer.renderToString(<App />)).toBe('<main>app</main>');
  });
});

import { runtime } from '@modern-js/plugin/runtime';
