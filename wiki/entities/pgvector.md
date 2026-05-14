---
title: "pgvector"
type: entity
tags: [postgresql, vector-search, embedding, postgres-extension]
sources: [overview.md, PgSearchBackend.md, pg-search-backend-postgresql-pgvector-search-backend.md, search-backend-abstraction-layer.md]
---

# pgvector

pgvector is an open-source PostgreSQL extension that adds vector similarity search capabilities to the relational database. In the context of this wiki, pgvector serves as the vector search engine powering the `PgSearchBackend` implementation of the `SearchBackend` abstraction layer, enabling hybrid search that combines traditional full-text search with semantic vector similarity. It stores and indexes embedding vectors generated from page content, allowing the wiki to perform "did you mean" suggestions, type-based ranking boosts, and CJK-aware semantic matching alongside PostgreSQL's native `tsvector` full-text search. The extension is used in conjunction with Psycopg2 connection pooling and supports index/embedding lifecycle management, including `rebuild_embeddings()` and `search_semantic()` operations. Its adoption reflects a design preference for consolidating vector and relational workloads within a single PostgreSQL instance, rather than relying on a separate dedicated vector database. The `PgSearchBackend` class directly depends on pgvector for all vector operations, making it a critical dependency of the wiki's search infrastructure.