---
title: "useDocumentTitle — Document Title Hook"
type: source
tags: [frontend, typescript, react, hook, i18n]
date: 2026-05-14
source_file: useDocumentTitle.ts
---

## Summary
The `useDocumentTitle` hook (`useDocumentTitle.ts`) synchronizes the browser's document title with the active page, using internationalized meta titles via [[i18next]]. It adjusts the title dynamically upon page changes and when the user switches language, then cleans up the event listener on unmount.

## Key Claims
- **Dynamic page title**: When a `pageTitle` string is provided, the document title becomes `"{pageTitle} | {translatedBase}"`. Without a heading, only the base (drawn from `i18n.t('meta.title')`) is used.
- **Live language switch**: Listens to i18next's `languageChanged` event and re-applies the current `pageTitle` on language change, ensuring the title always reflects the active locale.
- **Clean teardown**: The `useEffect` returns a cleanup that removes the `languageChanged` listener, preventing memory leaks when the component unmounts.
- **Zero dependencies besides React and i18n**: Minimalistic — only imports `useEffect` from React and the i18next instance.

## Key Quotes
> "`const update = () => { const base = i18n.t('meta.title'); document.title = pageTitle ? `${pageTitle} | ${base}` : base; };`" — core logic for building the final title string

## Connections
- [[lazypage-component]] — likely caller that provides `pageTitle` to the hook
- [[PageDetailPage]] — another candidate that would set page-specific document titles
- [[RouterDefinition]] — routing layer that triggers the hook via page components
- [[LanguageSwitcher]] — language changes trigger the `languageChanged` event that this hook subscribes to

## Contradictions
- None identified.