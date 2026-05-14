---
title: "typeLabelKey"
type: entity
tags: [frontend, i18n, utility]
sources: [i18n-configuration-llm-wiki-viewer]
last_updated: 2026-05-14
---

# typeLabelKey

`typeLabelKey` is a utility function exported from the i18n configuration module (`index.ts`). It maps wiki page type slugs (`source`, `entity`, `concept`, `synthesis`) to their corresponding [[i18next]] translation keys (`type.source`, `type.entity`, `type.concept`, `type.synthesis`). This allows UI components to render localized human-readable labels for page types.

Signature: `function typeLabelKey(type: string): string`

### Connections
- [[i18next]] — provides the translation function
- [[Header]] — may use type labels in search results
- [[Sidebar]] — may use type labels in navigation