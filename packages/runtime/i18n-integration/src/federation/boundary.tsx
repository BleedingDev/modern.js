import {
  type FederatedI18nBoundaryProps,
  getActualI18nextInstance,
  ModernI18nContext,
  ModernI18nProvider,
  ReactI18nextProviderContext,
} from '@modern-js/plugin-i18n/runtime/consumer';
import { type FC, useContext, useMemo } from 'react';

export type { FederatedI18nBoundaryProps } from '@modern-js/plugin-i18n/runtime/consumer';

/**
 * Keeps a federated surface's translation resources inside its delivery unit.
 * The host supplies only the active language; the remote owns and versions the
 * resources used below this boundary.
 */
export const FederatedI18nBoundary: FC<FederatedI18nBoundaryProps> = ({
  children,
  defaultNamespace,
  fallbackLanguage,
  resources,
  supportedLanguages,
}) => {
  const parent = useContext(ModernI18nContext);
  const I18nextProvider = useContext(ReactI18nextProviderContext);
  if (!parent) {
    throw new Error(
      'FederatedI18nBoundary must be used within ModernI18nProvider',
    );
  }

  const languages =
    supportedLanguages ?? parent.languages ?? Object.keys(resources);
  const scopedInstance = useMemo(() => {
    const parentInstance = getActualI18nextInstance(parent.i18nInstance);
    const clone = parentInstance.cloneInstance?.({
      defaultNS: defaultNamespace,
      fallbackLng: fallbackLanguage ?? languages[0] ?? parent.language,
      forkResourceStore: true,
      initImmediate: false,
      lng: parent.language,
      ns: [defaultNamespace],
      resources,
      supportedLngs: languages,
    });
    if (!clone) {
      throw new Error(
        'FederatedI18nBoundary requires an i18n instance with cloneInstance support',
      );
    }
    const resourceStore = clone.store;
    const parentResourceStore = parentInstance.store;
    const sharesNestedResourceState = Object.entries(
      resourceStore?.data ?? {},
    ).some(([language, namespaces]) => {
      const parentNamespaces = parentResourceStore?.data?.[language];
      return (
        namespaces === parentNamespaces ||
        Object.entries(namespaces).some(
          ([namespace, resource]) =>
            resource !== null &&
            typeof resource === 'object' &&
            resource === parentNamespaces?.[namespace],
        )
      );
    });
    if (
      clone === parentInstance ||
      resourceStore === parentResourceStore ||
      resourceStore?.data === parentResourceStore?.data ||
      sharesNestedResourceState
    ) {
      throw new Error(
        'FederatedI18nBoundary cloneInstance did not isolate the host resource store',
      );
    }
    if (
      !resourceStore?.addResourceBundle ||
      !clone.removeResourceBundle ||
      !resourceStore.data
    ) {
      throw new Error(
        'FederatedI18nBoundary requires an isolated mutable i18n resource store',
      );
    }
    for (const [language, namespaces] of Object.entries(resourceStore.data)) {
      for (const namespace of Object.keys(namespaces)) {
        clone.removeResourceBundle(language, namespace);
      }
    }
    for (const [language, namespaces] of Object.entries(resources)) {
      for (const [namespace, resource] of Object.entries(namespaces)) {
        resourceStore.addResourceBundle(
          language,
          namespace,
          resource as Record<string, string>,
          true,
          true,
        );
      }
    }
    return clone;
  }, [
    defaultNamespace,
    fallbackLanguage,
    languages,
    parent.i18nInstance,
    parent.language,
    resources,
  ]);
  const value = useMemo(
    () => ({
      ...parent,
      i18nInstance: scopedInstance,
      language: parent.language,
      languages,
    }),
    [languages, parent, scopedInstance],
  );

  const scopedContent = (
    <ModernI18nProvider value={value}>{children}</ModernI18nProvider>
  );
  return I18nextProvider ? (
    <I18nextProvider i18n={scopedInstance}>{scopedContent}</I18nextProvider>
  ) : (
    scopedContent
  );
};
