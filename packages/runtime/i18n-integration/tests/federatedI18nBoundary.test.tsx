import { runtime } from '@modern-js/plugin/runtime';
import {
  FederatedI18nBoundary,
  ModernI18nProvider,
  useModernI18n,
} from '@modern-js/plugin-i18n/runtime/consumer';
import { RuntimeComponentResolverContext } from '@modern-js/runtime/context';
import { describe, expect, test } from '@rstest/core';
import i18next, { type i18n } from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { i18nPlugin } from '../src/runtime';

const { runtimeContext } = runtime.run({
  config: {},
  plugins: [i18nPlugin({})],
});

const C0_COPY = 'C0 copy bundled by the shell';
const C1_COPY =
  'C1 operational independence: inventory UI and localization moved together.';

function InventoryCopy() {
  const modernI18n = useModernI18n<i18n>();
  const reactI18n = useTranslation('inventory');
  const reactI18nInstance = reactI18n.i18n as i18n & { __original?: i18n };
  const sharesScopedInstance =
    reactI18nInstance === modernI18n.i18nInstance ||
    reactI18nInstance.__original === modernI18n.i18nInstance;

  return (
    <p>
      {modernI18n.t('inventory.widgetBody')}|
      {reactI18n.t('inventory.widgetBody')}|{String(sharesScopedInstance)}
    </p>
  );
}

describe('FederatedI18nBoundary', () => {
  test('fails before mutation when cloneInstance does not isolate the host store', async () => {
    const hostI18n = i18next.createInstance();
    await hostI18n.init({
      defaultNS: 'inventory',
      initImmediate: false,
      lng: 'en',
      resources: {
        en: {
          inventory: {
            'inventory.widgetBody': C0_COPY,
          },
        },
      },
    });
    hostI18n.cloneInstance = () => hostI18n;

    expect(() =>
      renderToStaticMarkup(
        <RuntimeComponentResolverContext.Provider
          value={runtimeContext.hooks.resolveComponent.call}
        >
          <ModernI18nProvider
            i18nextProvider={I18nextProvider}
            value={{
              i18nInstance: hostI18n,
              language: 'en',
              languages: ['en'],
            }}
          >
            <FederatedI18nBoundary
              defaultNamespace="inventory"
              resources={{
                en: {
                  inventory: {
                    'inventory.widgetBody': C1_COPY,
                  },
                },
              }}
            >
              <InventoryCopy />
            </FederatedI18nBoundary>
          </ModernI18nProvider>
        </RuntimeComponentResolverContext.Provider>,
      ),
    ).toThrow(/did not isolate the host resource store/u);
    expect(hostI18n.t('inventory.widgetBody')).toBe(C0_COPY);
  });
});
