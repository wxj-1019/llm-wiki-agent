---
title: "LanguageSwitcher"
type: entity
tags: [frontend, react, component, i18n]
sources: [usekeyboardshortcuts-global-keyboard-shortcuts-hook]
last_updated: 2026-05-14
---

[[LanguageSwitcher]] is a React component in the [[LLMWikiViewer]] frontend that provides language selection (en/zh-CN). It triggers `languageChanged` i18next events that the [[UseDocumentTitle]] hook subscribes to. See [[header-component-wiki-viewer-navigation-bar]] for its usage in the Header.