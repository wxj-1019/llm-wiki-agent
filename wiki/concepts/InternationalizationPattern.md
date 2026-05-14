---
title: "InternationalizationPattern"
type: concept
tags: [frontend, i18n, architecture]
sources: [i18n-configuration-llm-wiki-viewer]
last_updated: 2026-05-14
---

# Internationalization Pattern

The Internationalization (i18n) Pattern describes how the LLM Wiki Viewer provides multilingual UI support. It uses [[i18next]] as the core framework with [[react-i18next]] for React integration and [[LanguageDetector]] for browser language auto-detection.

## Key Design Decisions
1. **Locale JSON files**: Translations are stored as `en.json` and `zh-CN.json` in a `locales/` directory, loaded statically at bundle time.
2. **Permissive typing**: TypeScript strict literal union types for translation resources are intentionally skipped to avoid compiler stack overflow and parameter position mis-assignment.
3. **localStorage-first detection**: Language preference is persisted in `localStorage` under `wiki-lang`, ensuring user choice survives page reloads and sessions.
4. **Reactive document sync**: On language change, `document.title` and `<html lang>` are updated reactively via the `languageChanged` event.
5. **Page type label mapping**: `typeLabelKey` helper converts wiki page type slugs to translation keys, enabling localized "Source", "Entity", "Concept", "Synthesis" labels.

## Connections
- [[i18next]] — core framework
- [[react-i18next]] — React binding
- [[LanguageDetector]] — browser detection
- [[LocalStorage]] — persistence layer
- [[Header]] — language switcher component
- [[router-configuration]] — route structure