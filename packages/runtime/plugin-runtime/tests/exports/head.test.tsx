import { initHooks } from '@modern-js/plugin/runtime';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Helmet as AsyncHelmet,
  HelmetData,
  HelmetProvider,
} from 'react-helmet-async';
import { RuntimeComponentResolverContext } from '../../src/core/context/runtime';
import { wrapRuntimeComponentResolver } from '../../src/core/react/wrapper';
import head, { Helmet } from '../../src/exports/head';

describe('native head component resolution', () => {
  it('preserves named/default exports and the unconfigured native Helmet behavior', () => {
    expect(head.Helmet).toBe(Helmet);
    expect(head.HelmetData).toBe(HelmetData);
    expect(head.HelmetProvider).toBe(HelmetProvider);
    const html = renderToString(
      <HelmetProvider>
        <head.Helmet>
          <title>Native head</title>
          <meta name="description" content="native" />
        </head.Helmet>
      </HelmetProvider>,
    );

    expect(html).toContain('<title>Native head</title>');
    expect(html).toContain('content="native"');
    expect(html).toBe(
      renderToString(
        <HelmetProvider>
          <AsyncHelmet>
            <title>Native head</title>
            <meta name="description" content="native" />
          </AsyncHelmet>
        </HelmetProvider>,
      ),
    );
  });

  it('chains component resolution while preserving unrelated component names', () => {
    const hooks = initHooks();
    const calls: string[] = [];
    const First = () => <span>first</span>;
    const value = React.createContext('outside');
    const Second = ({ title }: { title?: string }) => (
      <p>{`${title}:${React.useContext(value)}`}</p>
    );
    hooks.resolveComponent.tap((component, { name }) => {
      if (name !== 'head.Helmet') return component;
      calls.push('first');
      expect(component).toBe(AsyncHelmet);
      return First;
    });
    hooks.resolveComponent.tap((component, { name }) => {
      if (name !== 'head.Helmet') return component;
      calls.push('second');
      expect(component).toBe(First);
      return Second;
    });

    expect(hooks.resolveComponent.call(First, { name: 'unrelated' })).toBe(
      First,
    );
    const html = renderToString(
      wrapRuntimeComponentResolver(
        <value.Provider value="scoped">
          <Helmet title="Selected" />
        </value.Provider>,
        hooks,
      ),
    );

    expect(html).toBe('<p>Selected:scoped</p>');
    expect(calls).toEqual(['first', 'second']);
  });

  it('keeps resolver selection scoped to its provider', () => {
    const First = () => <p>first provider</p>;
    const Second = () => <p>second provider</p>;
    const tree = (
      <>
        <RuntimeComponentResolverContext.Provider value={() => First}>
          <Helmet />
        </RuntimeComponentResolverContext.Provider>
        <RuntimeComponentResolverContext.Provider value={() => Second}>
          <Helmet />
        </RuntimeComponentResolverContext.Provider>
      </>
    );
    expect(renderToString(tree)).toBe(
      '<p>first provider</p><p>second provider</p>',
    );
  });

  it('propagates resolver errors and rejects direct recursive resolution', () => {
    const error = new Error('resolver failed');
    expect(() =>
      renderToString(
        <RuntimeComponentResolverContext.Provider
          value={() => {
            throw error;
          }}
        >
          <Helmet />
        </RuntimeComponentResolverContext.Provider>,
      ),
    ).toThrow(error);
    expect(() =>
      renderToString(
        <RuntimeComponentResolverContext.Provider value={() => Helmet}>
          <Helmet />
        </RuntimeComponentResolverContext.Provider>,
      ),
    ).toThrow('cannot resolve head.Helmet to itself');
  });
});
