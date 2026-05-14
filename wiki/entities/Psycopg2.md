---
title: "psycopg2"
type: entity
tags: [python, database, postgresql, driver]
sources: [pg-search-backend-postgresql-pgvector-search-backend]
last_updated: 2026-05-14
---

**psycopg2** is the [[PostgreSQL]] database adapter for [[Python]]. Used by [[PgSearchBackend]] as the connection driver with `ThreadedConnectionPool` for concurrent access.

## Connections
- [[PgSearchBackend]] — uses psycopg2 connection pooling
- [[PostgreSQL]] — target database
- [[pgvector]] — PostgreSQL extension accessed via psycopg2
