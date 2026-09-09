import React from 'react';
import { setGlobalInternalRuntimeContext } from '../../../../src/core/context';
import { SSR_DATA_PLACEHOLDER } from '../../../../src/core/server/constants';
import { renderString } from '../../../../src/core/server/string';

const createRuntimeContext = () => {
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

  return runtimeContext;
};

const render = async (
  htmlTemplate: string,
  options: { entryName?: string } = {},
) => {
  setGlobalInternalRuntimeContext({
    hooks: {
      extendStringSSRCollectors: {
        call: () => [],
      },
    },
  } as any);

  return renderString(
    new Request('http://localhost/'),
    React.createElement('main', null, 'server markup'),
    {
      resource: {
        entryName: options.entryName ?? 'index',
        htmlTemplate,
        routeManifest: {},
      },
      runtimeContext: createRuntimeContext(),
      config: {},
      onError: () => {},
      onTiming: () => {},
    } as any,
  );
};

describe('renderString native marker assembly', () => {
  it('should fall back to in-place replacement when no entry script tag exists', async () => {
    const html = await render(
      [
        '<html><head></head><body><div id="root">',
        '<!--<?- html ?>-->',
        '</div>',
        '<span id="marker"></span>',
        SSR_DATA_PLACEHOLDER,
        '</body></html>',
      ].join(''),
    );

    const markerIndex = html.indexOf('<span id="marker"></span>');
    const ssrDataIndex = html.indexOf('window._SSR_DATA =');

    expect(markerIndex).toBeGreaterThan(-1);
    expect(ssrDataIndex).toBeGreaterThan(markerIndex);
    expect(html).not.toContain(SSR_DATA_PLACEHOLDER);
  });

  it('should preserve a custom template that omits script markers', async () => {
    const template =
      '<html><head><script async src="/static/js/index.js"></script></head><body>custom shell</body></html>';
    const runtimeContext = createRuntimeContext();
    runtimeContext.ssrContext.request.headers = {
      'x-request-id': 'request-1',
    };

    const html = await renderString(
      new Request('http://localhost/'),
      React.createElement('main', null, 'server markup'),
      {
        resource: {
          entryName: 'index',
          htmlTemplate: template,
          routeManifest: {},
        },
        runtimeContext,
        config: {
          ssr: {
            unsafeHeaders: ['x-request-id'],
          },
        },
        onError: () => {},
        onTiming: () => {},
      } as any,
    );

    expect(html).toBe(template);
  });
});
