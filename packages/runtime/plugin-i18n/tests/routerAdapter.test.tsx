import {
  InternalRuntimeContext,
  RuntimeContext,
} from '@modern-js/runtime/context';
import type React from 'react';
import type { ComponentType, PropsWithChildren } from 'react';
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { i18nPlugin } from '../src/runtime';
import { ModernI18nProvider, useModernI18n } from '../src/runtime/context';
import type { I18nInstance } from '../src/runtime/i18n';
import { getReactI18nextIntegration } from '../src/runtime/i18n/react-i18next';
import { Link } from '../src/runtime/Link';
import {
  createI18nRootWrapper,
  type I18nLanguageSynchronizationProps,
} from '../src/runtime/providerComposition';
import {
  I18nNavigationProvider,
  useI18nRouterAdapter,
} from '../src/runtime/routerAdapter';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const requestContext = {
  request: {},
  response: {},
};

function createI18nInstance(language = 'en'): I18nInstance {
  return {
    language,
    isInitialized: true,
    init: () => Promise.resolve(undefined),
    use: () => {},
    t: (key: string | string[]) => (Array.isArray(key) ? key[0] : key),
    createInstance: () => createI18nInstance(language),
    setLang: rstest.fn(async () => undefined),
    changeLanguage: rstest.fn(async () => undefined),
    services: {},
    options: {},
  };
}

function collectI18nWrapRoot() {
  let wrapRoot: ((App: ComponentType<any>) => ComponentType<any>) | undefined;

  i18nPlugin({
    reactI18next: false,
    localeDetection: {
      fallbackLanguage: 'en',
    },
  }).setup?.({
    getRuntimeConfig: () => ({}),
    onBeforeRender: () => undefined,
    wrapRoot: (callback: (App: ComponentType<any>) => ComponentType<any>) => {
      wrapRoot = callback;
    },
  } as any);

  if (!wrapRoot) {
    throw new Error('Expected i18n runtime plugin to register wrapRoot');
  }

  return wrapRoot;
}

async function renderI18nRoot(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <RuntimeContext.Provider
        value={{
          isBrowser: true,
          requestContext,
          context: requestContext,
        }}
      >
        {node}
      </RuntimeContext.Provider>,
    );
  });

  return {
    container,
    root,
  };
}

function cleanup(rendered?: { container: HTMLElement; root: Root }) {
  if (!rendered) {
    return;
  }
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe('i18n runtime wrapRoot', () => {
  let rendered: { container: HTMLElement; root: Root } | undefined;

  afterEach(() => {
    cleanup(rendered);
    rendered = undefined;
    rstest.useRealTimers();
    rstest.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  test('renders children when no root App exists yet', async () => {
    const wrapRoot = collectI18nWrapRoot();
    const I18nRoot = wrapRoot(undefined as unknown as ComponentType<any>);

    rendered = await renderI18nRoot(
      <I18nRoot>
        <main>router content</main>
      </I18nRoot>,
    );

    expect(rendered.container.textContent).toContain('router content');
  });

  test('preserves App props and children', async () => {
    const wrapRoot = collectI18nWrapRoot();
    const App = ({ children, label }: PropsWithChildren<{ label: string }>) => (
      <main data-label={label}>{children}</main>
    );
    const I18nRoot = wrapRoot(App);

    rendered = await renderI18nRoot(
      <I18nRoot label="root">
        <span>router content</span>
      </I18nRoot>,
    );

    expect(
      rendered.container.querySelector('main')?.getAttribute('data-label'),
    ).toBe('root');
    expect(rendered.container.textContent).toContain('router content');
  });

  test('keeps the optional i18next provider inside Modern i18n context', async () => {
    const i18nInstance = createI18nInstance('cs');
    const observedLanguages: string[] = [];
    const I18nextProvider = ({
      children,
      i18n,
    }: PropsWithChildren<{ i18n: I18nInstance }>) => {
      const { language } = useModernI18n();
      observedLanguages.push(`${language}:${i18n.language}`);

      return <section data-testid="i18next-provider">{children}</section>;
    };
    const App = () => <main>router content</main>;
    const I18nRoot = createI18nRootWrapper({
      htmlLangAttr: false,
      localePathRedirect: false,
      languages: ['en', 'cs'],
      fallbackLanguage: 'en',
      getLatestI18nInstance: () => i18nInstance,
      getI18nextProvider: () => I18nextProvider,
    })(App);

    rendered = await renderI18nRoot(<I18nRoot />);

    expect(observedLanguages).toEqual(['cs:cs']);
    expect(rendered.container.textContent).toContain('router content');
  });

  test('keeps the i18next provider instance stable across unrelated parent renders', async () => {
    const i18nInstance = createI18nInstance('cs');
    const providerInstances: I18nInstance[] = [];
    const I18nextProvider = ({
      children,
      i18n,
    }: PropsWithChildren<{ i18n: I18nInstance }>) => {
      providerInstances.push(i18n);
      return <>{children}</>;
    };
    const App = () => <main>router content</main>;
    const I18nRoot = createI18nRootWrapper({
      htmlLangAttr: false,
      localePathRedirect: false,
      languages: ['en', 'cs'],
      fallbackLanguage: 'en',
      getLatestI18nInstance: () => i18nInstance,
      getI18nextProvider: () => I18nextProvider,
    })(App);
    const Parent = () => {
      const [renderVersion, setRenderVersion] = useState(0);
      return (
        <>
          <button
            type="button"
            onClick={() => setRenderVersion(version => version + 1)}
          >
            Render {renderVersion}
          </button>
          <I18nRoot renderVersion={renderVersion} />
        </>
      );
    };

    rendered = await renderI18nRoot(<Parent />);
    const initialProviderInstance = providerInstances.at(-1);

    await act(async () => {
      rendered?.container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(providerInstances.length).toBeGreaterThan(1);
    expect(providerInstances.at(-1)).toBe(initialProviderInstance);
  });
});

describe('i18n react-i18next integration', () => {
  test('loads the bundled react-i18next integration', async () => {
    const integration = await getReactI18nextIntegration();

    expect(integration.I18nextProvider).toEqual(expect.any(Function));
    expect(integration.initReactI18next).toBeDefined();
  });
});

describe('native navigation extension contract', () => {
  test('renders the supplied router primitive and exposes provider-scoped navigation', async () => {
    const navigate = rstest.fn();
    const RouterLink = ({ to, children }: any) => (
      <a href={to} data-native="yes">
        {children}
      </a>
    );
    function Consumer() {
      const adapter = useI18nRouterAdapter();
      expect(adapter.navigate).toBe(navigate);
      expect(adapter.params).toEqual({ lang: 'cs' });
      return <Link to="/products?tag=x#detail">Products</Link>;
    }
    const rendered = await renderI18nRoot(
      <I18nNavigationProvider
        value={{
          hasRouter: true,
          navigate,
          params: { lang: 'cs' },
          location: { pathname: '/cs/products', search: '', hash: '' },
          Link: RouterLink,
        }}
      >
        <ModernI18nProvider
          value={{
            language: 'cs',
            i18nInstance: createI18nInstance('cs'),
            languages: ['en', 'cs'],
            localePathRedirect: true,
          }}
        >
          <Consumer />
        </ModernI18nProvider>
      </I18nNavigationProvider>,
    );
    try {
      expect(rendered.container.querySelector('a')?.getAttribute('href')).toBe(
        '/cs/products?tag=x#detail',
      );
      expect(
        rendered.container.querySelector('a')?.getAttribute('data-native'),
      ).toBe('yes');
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      cleanup(rendered);
    }
  });
});

describe('native synchronization extension contract', () => {
  test('uses the supplied component callback and preserves its state across parent renders', async () => {
    const instance = createI18nInstance('en');
    const synchronize = rstest.fn();
    const mounts = rstest.fn();
    const observed: I18nLanguageSynchronizationProps[] = [];
    const Synchronization = (props: I18nLanguageSynchronizationProps) => {
      observed.push(props);
      useEffect(() => {
        mounts();
        props.setLang('cs');
      }, []);
      return props.children(synchronize);
    };
    const Root = createI18nRootWrapper({
      htmlLangAttr: false,
      localePathRedirect: true,
      languages: ['en', 'cs'],
      fallbackLanguage: 'en',
      getLatestI18nInstance: () => instance,
      getI18nextProvider: () => null,
      LanguageSynchronization: Synchronization,
    })(() => {
      const { language } = useModernI18n();
      return <main>{language}</main>;
    });
    window.history.replaceState(null, '', '/cs/products');
    const rendered = await renderI18nRoot(<Root />);
    try {
      expect(rendered.container.textContent).toBe('cs');
      expect(synchronize).toHaveBeenCalledWith('cs');
      expect(observed.at(-1)?.i18nInstance).toBe(instance);
      expect(observed.at(-1)?.pathname).toBe('/cs/products');
      expect(observed.at(-1)?.prevLangRef.current).toBe('cs');
      await act(async () => {
        rendered.root.render(
          <RuntimeContext.Provider
            value={{ isBrowser: true, requestContext, context: requestContext }}
          >
            <Root unrelated="updated" />
          </RuntimeContext.Provider>,
        );
      });
      expect(mounts).toHaveBeenCalledTimes(1);
      expect(rendered.container.textContent).toBe('cs');
      expect(instance.changeLanguage).not.toHaveBeenCalled();
    } finally {
      cleanup(rendered);
      window.history.replaceState(null, '', '/');
    }
  });
});
