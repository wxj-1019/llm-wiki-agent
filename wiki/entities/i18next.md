---
title: "i18next"
type: entity
tags: [frontend, i18n, library]
sources: [i18n-configuration-llm-wiki-viewer]
last_updated: 2026-05-14
---

# i18next

i18next is a popular internationalization (i18n) framework for JavaScript. It provides translation management, interpolation, pluralization, and language detection. In the LLM Wiki Viewer, it is used via the [[react-i18next]] binding and configured with the [[LanguageDetector]] plugin for browser language auto-detection.

### Connections
- [[LanguageDetector]] — browser language detection plugin
- [[react-i18next]] — React integration
- [[Header]] — uses i18next-powered translations
- [[typeLabelKey]] — helper that maps page types to i18n translation keys