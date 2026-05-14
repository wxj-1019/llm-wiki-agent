---
title: "SUPPORTED_LANGUAGES"
type: entity
tags: [frontend, typescript, i18n, configuration, localization]
sources: [LanguageSwitcher.md, header-component-wiki-viewer-navigation-bar.md]
---

# SUPPORTED_LANGUAGES

`SUPPORTED_LANGUAGES` is a static configuration entity — likely defined as a typed constant or array of objects — that enumerates the set of languages available in the LLMWikiViewer frontend's internationalization (i18n) system. Each language entry in this list includes at minimum a `value` property containing the language code (e.g., `"en"`, `"ko"`) and a `label` property for the human-readable display name. Additionally, each language entry carries an `icon` property referencing the Globe icon from the Lucide library, ensuring visual consistency in the UI. `SUPPORTED_LANGUAGES` is consumed by the LanguageSwitcher component, which maps it directly into options for the AppleSelect dropdown, enabling the user to change the active interface language via `i18n.changeLanguage()`. As a foundational element of the localization layer, `SUPPORTED_LANGUAGES` effectively defines the frontend's multi-language boundary — any language not present in this list is neither selectable nor supported. It is referenced without additional dynamic filtering, implying a fixed list maintained alongside the i18n resource bundles. This entity does not appear to participate in runtime state management directly but acts as a declarative source of truth for the i18n configuration.