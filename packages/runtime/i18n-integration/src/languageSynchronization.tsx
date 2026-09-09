import { useLanguageSync } from '@modern-js/i18n-runtime-extensions';
import type { I18nLanguageSynchronizationProps } from '@modern-js/plugin-i18n/runtime/no-react-i18next';

/** Bind the shared controller to this native provider's instance and state. */
export const I18nLanguageSynchronization = ({
  i18nInstance,
  localePathRedirect,
  languages,
  pathname,
  prevLangRef,
  setLang,
  children,
}: I18nLanguageSynchronizationProps) => {
  const synchronizeLanguage = useLanguageSync(
    i18nInstance,
    localePathRedirect,
    languages,
    pathname,
    prevLangRef,
    setLang,
  );
  return children(synchronizeLanguage);
};
