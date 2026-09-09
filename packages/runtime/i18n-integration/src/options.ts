import type { LocalisedUrlsOption } from '@modern-js/i18n-runtime-extensions';
import type { I18nPluginOptions as NativeRuntimeOptions } from '@modern-js/plugin-i18n/runtime/no-react-i18next';
import type { I18nPluginOptions as NativeServerOptions } from '@modern-js/plugin-i18n/server';

export type IntegratedLocaleDetectionOptions = NonNullable<
  NativeRuntimeOptions['localeDetection']
> & {
  localisedUrls?: LocalisedUrlsOption;
  localeDetectionByEntry?: Record<string, IntegratedLocaleDetectionOptions>;
};

export type I18nPluginOptions = NativeRuntimeOptions & {
  localeDetection?: IntegratedLocaleDetectionOptions;
};

export type I18nServerPluginOptions = NativeServerOptions & {
  localeDetection: IntegratedLocaleDetectionOptions;
};
