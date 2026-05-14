---
title: "WikiSourcePage"
type: entity
tags: [wiki, source, page-type]
sources: [refresh-tool-stale-source-page-refresher]
last_updated: 2026-05-14
---

# WikiSourcePage

A `WikiSourcePage` is a wiki page of type `source` that documents a raw source document. It lives in `wiki/sources/<slug>.md` and contains YAML frontmatter with a `source_file:` field pointing back to the original raw document. The [[RefreshTool]] monitors these pages for staleness by checking if the raw document has changed since the last refresh.