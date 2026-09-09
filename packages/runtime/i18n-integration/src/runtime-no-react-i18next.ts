import { i18nPlugin as nativeI18nPlugin } from '@modern-js/plugin-i18n/runtime/no-react-i18next';
import { composeI18nPlugin } from './runtimeComposition';

export const i18nPlugin = composeI18nPlugin(nativeI18nPlugin);
export default i18nPlugin;
