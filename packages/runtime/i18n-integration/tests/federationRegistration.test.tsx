import { runtime } from '@modern-js/plugin/runtime';
import {
  ModernI18nProvider,
  FederatedI18nBoundary as NativeBoundary,
  useModernI18n,
} from '@modern-js/plugin-i18n/runtime/consumer';
import { RuntimeComponentResolverContext } from '@modern-js/runtime/context';
import { describe, expect, test } from '@rstest/core';
import i18next from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { FederatedI18nBoundary } from '../src/federation/boundary';
import { i18nPlugin } from '../src/runtime';
import { i18nPlugin as noReactI18nPlugin } from '../src/runtime-no-react-i18next';

const marker = { name: 'i18n.FederatedI18nBoundary' };
const Fallback = () => null;

describe('federation registration in the combined runtime', () => {
  test.each([
    ['default', i18nPlugin],
    ['no-react-i18next', noReactI18nPlugin],
  ] as const)('%s runtime resolves federation and preserves unrelated components', (_, factory) => {
    const { runtimeContext } = runtime.run({
      config: {},
      plugins: [factory({})],
    });
    const resolve = runtimeContext.hooks.resolveComponent.call;
    expect(resolve(Fallback, marker)).toBe(FederatedI18nBoundary);
    expect(resolve(Fallback, { name: 'another.Component' })).toBe(Fallback);
  });

  test('keeps registrations isolated between runtime instances', () => {
    const registered = runtime.run({
      config: {},
      plugins: [i18nPlugin({})],
    }).runtimeContext;
    const nativeOnly = runtime.run({ config: {}, plugins: [] }).runtimeContext;
    expect(nativeOnly.hooks.resolveComponent.call(Fallback, marker)).toBe(
      Fallback,
    );
    expect(registered.hooks.resolveComponent.call(Fallback, marker)).toBe(
      FederatedI18nBoundary,
    );
  });

  test('scopes native consumers when react-i18next integration is absent', async () => {
    const host = i18next.createInstance();
    await host.init({
      lng: 'en',
      initImmediate: false,
      defaultNS: 'inventory',
      resources: { en: { inventory: { title: 'host title' } } },
    });
    const { runtimeContext } = runtime.run({
      config: {},
      plugins: [noReactI18nPlugin({})],
    });
    function Copy() {
      const { t, i18nInstance } = useModernI18n();
      return (
        <p>
          {t('title')}|{String(i18nInstance !== host)}
        </p>
      );
    }
    const html = renderToStaticMarkup(
      <RuntimeComponentResolverContext.Provider
        value={runtimeContext.hooks.resolveComponent.call}
      >
        <ModernI18nProvider
          value={{ i18nInstance: host, language: 'en', languages: ['en'] }}
          i18nextProvider={null}
        >
          <NativeBoundary
            defaultNamespace="inventory"
            resources={{ en: { inventory: { title: 'remote title' } } }}
          >
            <Copy />
          </NativeBoundary>
        </ModernI18nProvider>
      </RuntimeComponentResolverContext.Provider>,
    );
    expect(html).toBe('<p>remote title|true</p>');
    expect(host.t('title')).toBe('host title');
  });
});
