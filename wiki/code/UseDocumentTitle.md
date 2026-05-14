---
type: code_func
title: "useDocumentTitle"
tags: [react, hook, i18n, frontend]
sources: [usetitle-document-title-hook]
---

# useDocumentTitle

## Signature
`function useDocumentTitle(pageTitle?: string): void`

## Purpose
Synchronizes the HTML document `<title>` with the current page and supports live language switching through [[i18next]].

## Parameters
- `pageTitle?`: Optional string. If provided, it produces the final title `"<pageTitle> | <translatedBase>"`. If omitted, only the translated base is used.

## Behavior
1. On mount (and whenever `pageTitle` changes), updates `document.title` immediately.
2. Listens to the `languageChanged` event on the [[i18next]] instance and reapplies the title when the language changes.
3. On unmount, removes the `languageChanged` listener to prevent stale updates.

## Related Code & Concepts
- Called in page components like [[PageDetailPage]] and [[HomePage]]
- Relies on [[LanguageSwitcher]] for language change
- Uses [[useEffect]] for side effects and cleanup