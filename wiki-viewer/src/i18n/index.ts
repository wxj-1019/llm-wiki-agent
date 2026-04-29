import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

// Intentionally skip custom type options to keep t() signatures permissive
// (the strict literal union typing from resources causes excessive depth
// and mis-assigns object options to defaultValue parameter position).

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
] as const;

export function typeLabelKey(type: string): string {
  const map: Record<string, string> = {
    source: 'type.source',
    entity: 'type.entity',
    concept: 'type.concept',
    synthesis: 'type.synthesis',
  };
  return map[type] || type;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wiki-lang',
    },
  });

// Sync document.title and html lang to current language
function updateTitle() {
  document.title = i18n.t('meta.title');
  document.documentElement.lang = i18n.language === 'zh-CN' ? 'zh-CN' : 'en';
}

i18n.on('languageChanged', updateTitle);
updateTitle();

export default i18n;
