---
title: "i18n Configuration — LLM Wiki Viewer Internationalization Setup"
type: source
tags: [frontend, typescript, i18n, internationalization, i18next]
date: 2026-05-14
source_file: wiki-viewer/src/i18n/index.ts
---

## Summary
The `wiki-viewer/src/i18n/index.ts` file initializes the internationalization (i18n) system for the LLM Wiki Viewer using [[i18next]], [[react-i18next]], and [[LanguageDetector]]. It configures English (`en`) and Simplified Chinese (`zh-CN`) locales, auto-detects the user's preferred language from `localStorage` or browser settings, keeps them synced in `localStorage` under the key `wiki-lang`, and dynamically updates `<html lang>` and `document.title` on language changes. Also exports a helper function `typeLabelKey` that maps wiki page type slugs to i18n translation keys.

## Key Claims
- **Dual language support**: Loads `en.json` and `zh-CN.json` locale files as translation resources. Falls back to English (`fallbackLng: 'en'`) when a translation key is missing in the active language.
- **Language detection via [[LanguageDetector]]**: Uses `localStorage` first (checking key `wiki-lang`), then `navigator` (browser language), and caches the detected language back to `localStorage` for persistence across sessions.
- **Reactive title & lang sync**: On initialization and every `languageChanged` event, updates `document.title` to `i18n.t('meta.title')` and sets `document.documentElement.lang` to `'zh-CN'` or `'en'`.
- **Permissive `t()` signatures**: Intentionally avoids strict literal union typing on translation resources to prevent TypeScript compiler stack overflow and mis-assignment of object options to `defaultValue` parameter position.
- **`typeLabelKey` helper**: Maps source/entity/concept/synthesis page types to translation keys (`type.source`, `type.entity`, `type.concept`, `type.synthesis`) so the UI can render human-readable labels in the active language.

## Key Quotes
> "`export const SUPPORTED_LANGUAGES = [ { code: 'en', label: 'English' }, { code: 'zh-CN', label: '简体中文' } ] as const;`" — supported language definition
> "`{ en: { translation: en }, 'zh-CN': { translation: zhCN } }`" — resource structure
> "`i18n.on('languageChanged', updateTitle);`" — reactive title sync
> "`const map: Record<string, string> = { source: 'type.source', entity: 'type.entity', concept: 'type.concept', synthesis: 'type.synthesis' };`" — type-to-key mapping

## Connections
- [[i18next]] — the core internationalization framework
- [[react-i18next]] — React integration for i18next
- [[LanguageDetector]] — browser language detection plugin
- [[Header]] — consumes translated labels and language switcher UI
- [[router-configuration]] — uses `useDocumentTitle` hook that may also contribute to `<title>`
- [[UseDocumentTitle]] — alternative title sync mechanism from React hooks
- [[typeLabelKey]] — exported helper used by component pages

## Contradictions
- None identified.