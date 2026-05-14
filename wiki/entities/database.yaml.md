---
title: "config/database.yaml"
type: entity
tags: [configuration, database, backend-selection, yaml, postgresql, psycopg2]
sources: [PgSearchBackend.md, pg-search-backend-postgresql-pgvector-search-backend.md, search-backend-abstraction-layer.md]
---

# config/database.yaml

`config/database.yaml` is the YAML configuration file responsible for specifying the database backend and connection parameters for the Personal LLM Wiki's search functionality. It is read by the singleton factory function `get_search_backend()` in the search backend abstraction layer to determine which concrete `SearchBackend` implementation to instantiate—either the default SQLite FTS5 backend or the more feature-rich PostgreSQL + pgvector backend. When the PostgreSQL backend is selected, the file provides the necessary connection parameters (host, port, dbname, user, password, sslmode) which are passed as a dictionary to the `PgSearchBackend` constructor, enabling Psycopg2 connection pooling for concurrent access. As the central switch point for database selection, it decouples the search system's configuration from its implementation, allowing operators to change backends without modifying application code. The file is typically located in a `config/` directory at the project root.