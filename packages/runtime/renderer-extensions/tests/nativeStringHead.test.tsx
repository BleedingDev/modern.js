import React from 'react';
import { RenderLevel } from '../../plugin-runtime/src/core/constants';
import { registerPlugin } from '../../plugin-runtime/src/core/plugin';
import { renderString } from '../../plugin-runtime/src/core/server/string';
import { Helmet } from '../../plugin-runtime/src/exports/head';
import { rendererHeadPlugin } from '../src/node';

describe('renderString', () => {
  it('collects helmet data without falling back to client render', async () => {
    const onErrorCalls: unknown[][] = [];
    const runtimeContext = {
      isBrowser: false,
      requestContext: {},
      context: {},
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
        reporter: { sessionId: 'session-1' },
      },
    };

    registerPlugin([rendererHeadPlugin()]);

    const html = await renderString(
      new Request('http://localhost/'),
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Helmet,
          null,
          React.createElement('title', null, 'Server Title'),
        ),
        React.createElement('main', null, 'SSR body'),
      ),
      {
        resource: {
          entryName: 'main',
          htmlTemplate:
            '<html><head><title>Default</title><!--<?- chunksMap.css ?>--></head><body><div id="root"><!--<?- html ?>--></div><!--<?- SSRDataScript ?>--><!--<?- chunksMap.js ?>--></body></html>',
          routeManifest: {},
        },
        runtimeContext,
        config: {},
        onError: (...args: unknown[]) => {
          onErrorCalls.push(args);
        },
        onTiming: () => {},
      } as any,
    );

    expect(onErrorCalls).toHaveLength(0);
    expect(html).toContain('<title data-rh="true">Server Title</title>');
    expect(html).toContain('SSR body');
    expect(html).toContain(`"renderLevel":${RenderLevel.SERVER_RENDER}`);
  });
  it('publishes only Helmet markers present in completed Suspense output', async () => {
    registerPlugin([rendererHeadPlugin()]);
    const never = new Promise<never>(() => {});
    const SuspendForever = (): null => {
      throw never;
    };

    const html = await renderString(
      new Request('http://localhost/'),
      <>
        <Helmet>
          <meta name="outside" content="committed" />
        </Helmet>
        <React.Suspense
          fallback={
            <>
              <Helmet>
                <meta name="fallback" content="committed" />
              </Helmet>
              fallback rendered
            </>
          }
        >
          <Helmet>
            <meta name="abandoned-unique" content="ghost" />
          </Helmet>
          <SuspendForever />
        </React.Suspense>
      </>,
      {
        resource: {
          entryName: 'index',
          htmlTemplate:
            '<html><head></head><body><!--<?- html ?>--></body></html>',
          routeManifest: {},
        },
        runtimeContext: {
          isBrowser: false,
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
            reporter: { sessionId: 'session-1' },
          },
        },
        config: {},
        onError: () => {},
        onTiming: () => {},
      } as any,
    );

    expect(html).toContain('name="outside" content="committed"');
    expect(html).toContain('name="fallback" content="committed"');
    expect(html).not.toContain('abandoned-unique');
    expect(html).not.toContain('data-modern-helmet');
  });
});
