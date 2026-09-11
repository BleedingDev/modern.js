import { RuntimeComponentResolverContext } from '@modern-js/runtime/context';
import { describe, expect, test } from '@rstest/core';
import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FederatedI18nBoundary,
  type FederatedI18nBoundaryProps,
} from '../src/runtime/context';

const props: FederatedI18nBoundaryProps = {
  defaultNamespace: 'inventory',
  resources: {},
  children: <span>child content</span>,
};

describe('native federation resolver wrapper', () => {
  test('retains the actionable fallback when a resolver does not handle i18n', () => {
    expect(() =>
      renderToStaticMarkup(
        <RuntimeComponentResolverContext.Provider
          value={component => component}
        >
          <FederatedI18nBoundary {...props} />
        </RuntimeComponentResolverContext.Provider>,
      ),
    ).toThrow(/requires the @modern-js\/i18n-integration runtime plugin/);
  });

  test('rejects resolution back to the native wrapper', () => {
    expect(() =>
      renderToStaticMarkup(
        <RuntimeComponentResolverContext.Provider
          value={() => FederatedI18nBoundary}
        >
          <FederatedI18nBoundary {...props} />
        </RuntimeComponentResolverContext.Provider>,
      ),
    ).toThrow(/resolver returned its own wrapper/);
  });

  test('renders the resolved hook-bearing component with unchanged props', () => {
    let receivedProps: FederatedI18nBoundaryProps | undefined;
    function ResolvedBoundary(value: FederatedI18nBoundaryProps) {
      receivedProps = value;
      const [label] = useState('resolved');
      return (
        <section>
          {label}:{value.children}
        </section>
      );
    }
    const html = renderToStaticMarkup(
      <RuntimeComponentResolverContext.Provider
        value={(component, { name }) =>
          name === 'i18n.FederatedI18nBoundary' ? ResolvedBoundary : component
        }
      >
        <FederatedI18nBoundary {...props} />
      </RuntimeComponentResolverContext.Provider>,
    );
    expect(html).toBe('<section>resolved:<span>child content</span></section>');
    expect(receivedProps?.resources).toBe(props.resources);
    expect(receivedProps?.defaultNamespace).toBe('inventory');
  });
});
