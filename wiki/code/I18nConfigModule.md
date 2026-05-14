---
title: "I18nConfigModule"
type: code_module
tags: [frontend, typescript, i18n]
sources: [i18n-configuration-llm-wiki-viewer]
last_updated: 2026-05-14
---

# I18nConfigModule

**File:** `wiki-viewer/src/i18n/index.ts`

Initializes the internationalization (i18n) system for the LLM Wiki Viewer using [[i18next]], [[react-i18next]], and [[LanguageDetector]].

## Exports

### `SUPPORTED_LANGUAGES`
```typescript
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
] as const;
```
Array of supported language objects with `code` and `label` fields, typed as `readonly` for type safety.

### `typeLabelKey(type: string): string`
Maps wiki page type slugs to [[i18next]] translation keys. Internal map: `source` → `"type.source"`, `entity` → `"type.entity"`, `concept` → `"type.concept"`, `synthesis` → `"type.synthesis"`. Returns the raw `type` string if not found in the map.

### `updateTitle()` (internal)
Syncs `document.title` with `i18n.t('meta.title')` and sets `document.documentElement.lang` to `'zh-CN'` or `'en'` based on the current language.

### `i18n` (default export)
The configured [[i18next]] instance, initialized with:
- Resources: `{ en: { translation: en }, 'zh-CN': { translation: zhCN } }`
- `fallbackLng: 'en'`
- `interpolation: { escapeValue: false }`
- Detection: `localStorage` (key `wiki-lang`) first, then `navigator`, caches to `localStorage`
- Language change listener: updates title and `<html lang>`

## Connections
- [[i18next]] — core i18n framework
- [[react-i18next]] — React binding
- [[LanguageDetector]] — browser detection plugin
- [[Header]] — uses translations and `SUPPORTED_LANGUAGES`
- [[UseDocumentTitle]] — alternative title sync mechanism