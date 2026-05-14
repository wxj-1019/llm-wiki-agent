---
title: "CJKTokenizationStrategy"
type: concept
tags: [search, cjk, tokenization, fts, bigram]
sources: [pg-search-backend-postgresql-pgvector-search-backend]
last_updated: 2026-05-14
---

**CJK Tokenization Strategy** refers to the approach used by [[PgSearchBackend]] to handle Chinese/Japanese/Korean text in full-text search. It first attempts to use the pre-installed `zh_cfg` zhparser text search configuration on PostgreSQL. If zhparser is unavailable and `cjk_parser` config is set to `auto` or `bigram_app`, it falls back to a custom `tokenize_cjk_bigrams` function that splits CJK characters into character bigrams. This ensures that CJK content is still searchable even without native Chinese FTS support.

## Connections
- [[PgSearchBackend]] — implements the strategy
- [[PostgreSQL]] — provides the text search framework
- [[zhparser]] — PostgreSQL extension for Chinese text parsing
