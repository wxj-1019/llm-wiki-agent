---
title: "react-i18next"
type: entity
tags: [frontend, i18n, react]
sources: [i18n-configuration-llm-wiki-viewer]
last_updated: 2026-05-14
---

# react-i18next

react-i18next is the React binding for [[i18next]], providing hooks like `useTranslation()` and the `Trans` component for rendering translated text with interpolation and rich HTML. Used by the LLM Wiki Viewer's [[Header]], [[Sidebar]], and other components to render UI text in the active locale.

### Connections
- [[i18next]] — core i18n framework
- [[Header]] — consumes translations
- [[Sidebar]] — consumes translations
- [[LanguageDetector]] — language detection plugin