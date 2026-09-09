import { getLocaleDetectionOptions } from '@modern-js/plugin-i18n/config';
import { i18nServerPlugin as nativeI18nServerPlugin } from '@modern-js/plugin-i18n/server';
import type {
  I18nServerPluginOptions,
  IntegratedLocaleDetectionOptions,
} from './options';
import { createI18nUrlStrategy } from './urlStrategy';

export const i18nServerPlugin = (options: I18nServerPluginOptions) =>
  nativeI18nServerPlugin({
    ...options,
    resolveUrlStrategy:
      options.resolveUrlStrategy ??
      (entryName =>
        createI18nUrlStrategy(
          options.localeDetection
            ? (
                getLocaleDetectionOptions(
                  entryName,
                  options.localeDetection,
                ) as IntegratedLocaleDetectionOptions
              ).localisedUrls
            : undefined,
        )),
  });

export default i18nServerPlugin;
