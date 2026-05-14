---
title: "LanguageDetector"
type: entity
tags: [frontend, i18n, plugin]
sources: [i18n-configuration-llm-wiki-viewer]
last_updated: 2026-05-14
---

# LanguageDetector

LanguageDetector (`i18next-browser-languagedetector`) is a plugin for [[i18next]] that automatically detects the user's preferred language. In the LLM Wiki Viewer, it is configured to check `localStorage` first (key `wiki-lang`), then fall back to the browser's `navigator.language`. The detected language is cached back to `localStorage` for persistence across sessions.

### Connections
- [[i18next]] — core i18n framework
- [[react-i18next]] — React integration
- [[LocalStorage]] — used as detection/cache medium
- [[Header]] — language switcher triggers changes