---
title: "HybridSearch"
type: concept
tags: [search, vector, fts, ranking]
sources: [pg-search-backend-postgresql-pgvector-search-backend]
last_updated: 2026-05-14
---

**Hybrid Search** combines full-text search (keyword-based) with vector/semantic search (embedding-based) and merges results using weighted scoring. In [[PgSearchBackend]], the combination weight is configurable via `fts_weight` (default 0.6) and `vector_weight` (default 0.4). FTS scores are normalized by dividing by the max FTS score, and vector scores are computed as `1 - cosine_distance`. The final score is: `(norm_fts * fts_weight) + (norm_vec * vec_weight)`.

## Connections
- [[PgSearchBackend]] — implements hybrid search
- [[pgvector]] — provides vector distance functions
- [[SearchBackend]] — defines the `search()` method signature
- [[DatabaseAbstraction]] — related pattern for backend selection
