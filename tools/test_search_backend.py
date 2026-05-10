#!/usr/bin/env python3
"""Parameterized search backend tests.

Runs the same test suite against both SQLite (WikiSearchEngine) and
PostgreSQL (PgSearchBackend) to verify parity.

Usage:
    pytest tools/test_search_backend.py -v
    python tools/test_search_backend.py          # runs with pytest if available
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()

# Ensure tools/ is on path
sys.path.insert(0, str(REPO_ROOT / "tools"))


try:
    import pytest
except ImportError:
    print("pytest not installed. Install: pip install pytest")
    sys.exit(1)


@pytest.fixture(params=["sqlite", "postgresql"])
def backend(request):
    if request.param == "sqlite":
        from tools.search_engine import WikiSearchEngine
        # Use a temporary DB for isolation
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        engine = WikiSearchEngine(db_path=tmp.name)
        yield engine
        engine.close()
        os.unlink(tmp.name)
    else:
        from tools.shared.pg_search_backend import PgSearchBackend
        # Load PG config from config/database.yaml
        config_path = REPO_ROOT / "config" / "database.yaml"
        pg_config = {}
        if config_path.exists():
            import yaml
            cfg = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            pg_config = cfg.get("database", {}).get("postgresql", {})
        if not pg_config.get("password"):
            pytest.skip("PostgreSQL config not available or password not set")
        try:
            b = PgSearchBackend(pg_config)
        except Exception as e:
            pytest.skip(f"PostgreSQL not available: {e}")
        # Clean up leftover test pages from prior runs for isolation
        b.remove_page("test/page.md")
        b.remove_page("test/remove.md")
        b.remove_page("test/count.md")
        b.remove_page("test/semantic.md")
        b.remove_page("test/spelling.md")
        b.remove_page("test/cjk.md")
        b.remove_page("test/rebuild.md")
        yield b
        b.close()


class TestSearchBackend:
    def test_index_and_search(self, backend):
        backend.index_page("test/page.md", '---\ntitle: "Machine Learning"\ntype: concept\n---\nTest content about machine learning and neural networks.')
        results = backend.search("machine learning")
        assert results["count"] > 0
        # Result may match in title or excerpt (depending on tokenizer)
        assert len(results["results"]) > 0

    def test_remove_page(self, backend):
        backend.index_page("test/remove.md", '---\ntitle: "Remove Me"\ntype: source\n---\nContent to be removed xyz123.')
        assert backend.search("xyz123")["count"] > 0
        backend.remove_page("test/remove.md")
        assert backend.search("xyz123")["count"] == 0

    def test_count(self, backend):
        before = backend.count()
        backend.index_page("test/count.md", '---\ntitle: "Count Test"\ntype: source\n---\nCounting test page.')
        assert backend.count() == before + 1

    def test_semantic_search_degraded_or_ok(self, backend):
        backend.index_page("test/semantic.md", '---\ntitle: "Deep Learning"\ntype: concept\n---\nContent about deep learning and AI.')
        results = backend.search("深度学习", semantic=True)
        assert "results" in results
        assert "degraded" in results

    def test_did_you_mean(self, backend):
        backend.index_page("test/spelling.md", '---\ntitle: "Transformer Architecture"\ntype: concept\n---\nThe transformer architecture revolutionized NLP.')
        results = backend.search("transfomer")
        # May or may not suggest "transformer" depending on fuzzy match quality
        assert "did_you_mean" in results

    def test_cjk_search(self, backend):
        backend.index_page("test/cjk.md", '---\ntitle: "量化交易"\ntype: concept\n---\n量化交易是指使用数学模型进行交易决策。')
        results = backend.search("量化交易")
        assert results["count"] > 0

    def test_rebuild_index(self, backend):
        backend.index_page("test/rebuild.md", '---\ntitle: "Rebuild"\ntype: source\n---\nRebuild test.')
        assert backend.count() >= 1
        backend.rebuild_index()
        # After rebuild, count may differ based on wiki/ dir contents
        # Just verify it doesn't crash
        assert backend.count() >= 0


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
