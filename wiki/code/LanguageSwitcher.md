---
title: "LanguageSwitcher — Language Selection Component"
type: code_module
tags: [frontend, typescript, react, i18n]
sources: [header-component-wiki-viewer-navigation-bar]
last_updated: 2026-05-14
---

## Signature
```tsx
function LanguageSwitcher(): JSX.Element
```

## Purpose
Inline component within [[Header]] that provides a language selection dropdown using [[AppleSelect]] UI component.

## Details
- Uses `useTranslation()` from [[i18next]] to get `i18n` instance
- Maps [[SUPPORTED_LANGUAGES]] to options with `value` (language code), `label` (display name), and `icon` ([[Globe]] from [[Lucide]])
- Calls `i18n.changeLanguage(code)` on user selection
- Styled with `relative w-full sm:w-36` container

## Related
- [[Header]] — parent component
- [[AppleSelect]] — UI primitive
- [[SUPPORTED_LANGUAGES]] — language configuration