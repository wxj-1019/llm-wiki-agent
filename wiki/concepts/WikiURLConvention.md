---
title: "Wiki URL Convention"
type: concept
tags: [routing, url, convention, wiki]
sources: [router-configuration]
last_updated: 2026-05-14
---

**Wiki URL Convention** defines the URL structure for navigating the [[LLMWikiViewer|LLM Wiki Viewer]]'s content pages.

## Route Patterns
- `/s/:slug` — Source pages (e.g., `/s/router-configuration`)
- `/e/:name` — Entity pages (e.g., `/e/ReactRouter`)
- `/c/:name` — Concept pages (e.g., `/c/LazyLoadingStrategy`)
- `/y/:slug` — Synthesis pages (e.g., `/y/foundation-models-overview`)

## Benefits
- Clear separation of content types in the URL
- Enables the generic `PageDetailPage` component to handle all types via the `type` prop
- Consistent with wiki [[naming conventions]] (kebab-case for slugs, TitleCase for entity/concept names)

## Related
- [[router-configuration|Router Configuration]]
- [[PageDetailPage]]