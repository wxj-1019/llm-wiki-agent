#!/usr/bin/env python3
"""Search backend abstraction layer.

Defines a pluggable SearchBackend interface so the wiki can use
either SQLite FTS5 or PostgreSQL + pgvector without callers knowing
which backend is active.

Implementations:
  - SQLiteSearchBackend  (tools/search_engine.py → WikiSearchEngine)
  - PgSearchBackend      (PostgreSQL + pgvector, Phase 3)

Usage:
  from tools.shared.search_backend import get_search_backend
  backend = get_search_backend()     # reads config/database.yaml
  results = backend.search("量化交易", limit=10)
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class SearchBackend(ABC):
    """Abstract search backend for wiki pages.

    All search, indexing, and maintenance operations go through this
    interface so the underlying engine (SQLite FTS5 / PostgreSQL+pgvector)
    can be swapped via configuration.
    """

    @abstractmethod
    def search(self, query: str, limit: int = 20,
               semantic: bool = False) -> dict[str, Any]:
        """Search wiki pages.

        Returns: {
            "results": [{path, title, type, rank, excerpt}, ...],
            "count": int,
            "did_you_mean": str | None,
            "degraded": bool,
        }
        """
        ...

    @abstractmethod
    def index_page(self, page_path: str, content: str) -> None:
        """Index or update a single wiki page in the search engine."""
        ...

    def update_page(self, page_path: str, content: str) -> None:
        """Alias for index_page. Updates an existing page's index entry."""
        self.index_page(page_path, content)

    @abstractmethod
    def remove_page(self, page_path: str) -> None:
        """Remove a page from the search index."""
        ...

    @abstractmethod
    def rebuild_index(self) -> None:
        """Drop and rebuild the entire search index from wiki/ files."""
        ...

    @abstractmethod
    def count(self) -> int:
        """Return number of indexed pages."""
        ...

    @abstractmethod
    def close(self) -> None:
        """Release backend resources (connections, cursors)."""
        ...

    # ── Optional vector operations ──

    def rebuild_embeddings(self) -> None:
        """Rebuild vector embeddings for all wiki pages (optional)."""
        pass

    def search_semantic(self, query: str, limit: int = 20) -> dict[str, Any]:
        """Convenience: hybrid FTS + vector search."""
        return self.search(query, limit=limit, semantic=True)


# ── Backend factory ─────────────────────────────────────────────────────────

_backend_instance: SearchBackend | None = None
_backend_lock = __import__('threading').Lock()


def get_search_backend(config_path: Path | None = None) -> SearchBackend:
    """Get the configured search backend singleton.

    Reads config/database.yaml to determine which backend to use.
    Falls back to SQLite if config is missing or backend is unavailable.
    """
    global _backend_instance
    if _backend_instance is not None:
        return _backend_instance

    with _backend_lock:
        if _backend_instance is not None:
            return _backend_instance

        # Determine config
        if config_path is None:
            from pathlib import Path as _Path
            config_path = _Path(__file__).parent.parent.parent / "config" / "database.yaml"

        backend_type = "sqlite"  # default
        pg_config: dict[str, Any] = {}

        if config_path.exists():
            try:
                import yaml
                cfg = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
                backend_type = cfg.get("database", {}).get("backend", "sqlite")
                pg_config = cfg.get("database", {}).get("postgresql", {})
            except Exception:
                backend_type = "sqlite"

        # PostgreSQL only (SQLite fallback removed per user requirement)
        if backend_type == "postgresql":
            from tools.shared.pg_search_backend import PgSearchBackend
            _backend_instance = PgSearchBackend(pg_config)
            return _backend_instance

        # If config explicitly requests sqlite, still allow it (for tests)
        from tools.search_engine import WikiSearchEngine
        _backend_instance = WikiSearchEngine()
        return _backend_instance


def reset_backend() -> None:
    """Reset the backend singleton (useful for testing)."""
    global _backend_instance
    with _backend_lock:
        if _backend_instance is not None:
            try:
                _backend_instance.close()
            except Exception:
                pass
            _backend_instance = None
