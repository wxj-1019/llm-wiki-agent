---
title: "WikiPageIndex"
type: entity
tags: [index, wiki, lookup]
sources: [auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# WikiPageIndex

An in-memory index of all wiki pages, built lazily from parsing `wiki/index.md`. Used by [[AutoIngestPipeline]] for entity detection and `[[wikilink]]` generation. Provides methods for:
- `lookup()` — find pages by stem_name
- `lookup_by_tag()` — find pages by type tag
- `get_related()` — find pages sharing source tags
- `fuzzy_search()` — substring matching on page titles

## Related
- [[AutoIngestPipeline]] — primary consumer
- [[WikiStore]] — conceptually similar Zustand store on the frontend side
