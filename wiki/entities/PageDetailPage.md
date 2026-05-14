---
title: "PageDetailPage"
type: entity
tags: [component, page, detail, react]
sources: [router-configuration]
last_updated: 2026-05-14
---

**PageDetailPage** is the generic wiki page detail renderer in the [[LLMWikiViewer|LLM Wiki Viewer]]. It handles multiple content types based on URL patterns.

- Defined in `@/components/pages/PageDetailPage`
- Accepts a `type` prop: `source`, `entity`, `concept`, or `synthesis`
- Route patterns in [[router-configuration|Router Configuration]]: `/s/:slug` (source), `/e/:name` (entity), `/c/:name` (concept), `/y/:slug` (synthesis)