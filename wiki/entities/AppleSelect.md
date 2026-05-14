---
title: "AppleSelect"
type: entity
tags: [ui, component, react, frontend]
sources: [LanguageSwitcher.md, header-component-wiki-viewer-navigation-bar.md]
---

# AppleSelect

`AppleSelect` is a reusable UI primitive component within the LLMWikiViewer frontend, designed to provide a stylized dropdown selection interface consistent with an Apple-inspired design language. In the context of this codebase, it serves as the core building block for the language selection feature in the `LanguageSwitcher` component, which is itself a child of the `Header` navigation bar. The component is typically instantiated with an array of options, each containing a `value` (language code), `label` (display name), and `icon` (such as the `Globe` icon from the Lucide icon library). It is configured with a responsive container (`relative w-full sm:w-36`) and supports interaction patterns like calling `i18n.changeLanguage()` upon user selection. As an entity, `AppleSelect` is not merely a generic `<select>` element but an opinionated, presentational component that contributes to the application's cohesive visual identity, emphasizing clarity and elegance in user choice interactions.