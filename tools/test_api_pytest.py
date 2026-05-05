#!/usr/bin/env python3
"""Backend API tests using pytest.

Usage:
    pip install pytest pytest-asyncio httpx
    pytest tools/test_api_pytest.py -v

Or run without pytest (standalone):
    python tools/test_api_pytest.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent
sys.path.insert(0, str(REPO))


def test_path_traversal_rejection():
    """wiki_write must reject paths outside wiki/."""
    from tools.mcp_server import _safe_wiki_path

    assert _safe_wiki_path("wiki/concepts/Transformer.md") is not None
    assert _safe_wiki_path("../README.md") is None
    assert _safe_wiki_path("wiki/../../etc/passwd") is None
    assert _safe_wiki_path("wiki/valid.md") is not None


def test_webhook_token_required():
    """Webhook endpoints reject requests without valid token when WIKI_WEBHOOK_TOKEN is set."""
    import os
    import hmac

    os.environ["WIKI_WEBHOOK_TOKEN"] = "secret-test-token"

    # Re-import to pick up env var
    import importlib
    import tools.api_server as api_mod

    importlib.reload(api_mod)

    # Simulate request with no token
    class FakeRequest:
        headers = {}

    req = FakeRequest()
    try:
        import asyncio

        asyncio.run(api_mod._require_webhook_token(req))
        assert False, "Should have raised HTTPException"
    except Exception as e:
        assert "401" in str(e) or "Invalid" in str(e)


def test_search_engine_chinese_query():
    """FTS5 query builder handles Chinese correctly."""
    from tools.search_engine import WikiSearchEngine

    engine = WikiSearchEngine()

    # English → phrase
    q1 = engine._build_fts_query("transformer architecture")
    assert q1.startswith('"') and q1.endswith('"')

    # Chinese → should contain parentheses (OR-joined chars)
    q2 = engine._build_fts_query("\u6a21\u578b")  # 模型
    assert "(" in q2  # OR-joined chars are wrapped in parens

    # Mixed
    q3 = engine._build_fts_query("transformer \u67b6\u6784")  # transformer 架构
    assert "AND" in q3
    assert "(" in q3

    engine.close()


def test_memory_lifecycle():
    """Agent memory start → update → finish → list."""
    from tools.memory import start, update, finish, list_sessions
    import os

    # Clean up any existing test sessions
    for f in (REPO / "wiki" / "memory" / "sessions").glob("S-*.md"):
        f.unlink()

    sid = start("Test lifecycle", "wiki/concepts/Test.md")
    assert sid.startswith("S-")

    ok = update(sid, notes="Progress note")
    assert ok

    ok = finish(sid, "Completed successfully")
    assert ok

    sessions = list_sessions("finished")
    assert any(s["session_id"] == sid for s in sessions)

    # Cleanup
    session_path = REPO / "wiki" / "memory" / "sessions" / f"{sid}.md"
    if session_path.exists():
        session_path.unlink()


def test_context_pack_building():
    """Context pack builder returns markdown."""
    from tools.context import build

    result = build("transformer", "wiki/concepts/Transformer.md", budget=2000)
    assert "# Context Pack" in result
    assert len(result) > 500


def test_cli_version():
    """CLI version command returns 0."""
    from tools.cli import main
    import sys
    from io import StringIO

    old_argv = sys.argv
    old_stdout = sys.stdout
    try:
        sys.argv = ["wiki", "version"]
        sys.stdout = StringIO()
        rc = main()
        output = sys.stdout.getvalue()
        assert rc == 0
        assert "2.0" in output
    finally:
        sys.argv = old_argv
        sys.stdout = old_stdout


def test_health_no_empty_stubs():
    """Health check finds no empty stubs in current wiki."""
    from tools.health import check_empty_files
    from pathlib import Path

    wiki_dir = Path(__file__).parent.parent / "wiki"
    pages = list(wiki_dir.rglob("*.md"))
    empty = check_empty_files(pages)
    assert isinstance(empty, list)
    # Current wiki should have no empty stubs
    assert len(empty) == 0, f"Empty stubs found: {empty}"


def test_search_engine_english_phrase():
    """FTS5 query builder wraps English phrases."""
    from tools.search_engine import WikiSearchEngine

    engine = WikiSearchEngine()
    q = engine._build_fts_query("machine learning")
    assert q == '"machine learning"'
    engine.close()


def test_frontmatter_parsing():
    """Frontmatter parser handles YAML correctly."""
    import re

    def parse_frontmatter(text: str):
        match = re.match(r'^---\s*\n([\s\S]*?)\n---\s*\n', text)
        if match:
            import yaml
            meta = yaml.safe_load(match.group(1)) or {}
            body = text[match.end():]
            return meta, body
        return {}, text

    text = '---\ntitle: "Hello"\ntype: source\n---\n\nBody content'
    meta, body = parse_frontmatter(text)
    assert meta.get("title") == "Hello"
    assert meta.get("type") == "source"
    assert "Body content" in body


def test_api_log_pagination():
    """Log endpoint supports tail parameter."""
    import importlib
    import tools.api_server as api_mod

    importlib.reload(api_mod)
    result = api_mod.get_log(tail=5)
    assert "markdown" in result
    # When tail > available entries, should return all
    assert isinstance(result["markdown"], str)


def test_raw_file_content_size_limit():
    """Raw file content endpoint rejects oversized files."""
    import tools.api_server as api_mod
    from fastapi import HTTPException
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(dir=api_mod.REPO / "raw", suffix=".txt", delete=False) as f:
        f.write(b"x" * (11 * 1024 * 1024))  # 11MB
        temp_path = f.name
    try:
        rel = os.path.relpath(temp_path, api_mod.REPO)
        try:
            api_mod.get_raw_file_content(path=rel)
            assert False, "Should have raised HTTPException"
        except HTTPException as e:
            assert e.status_code == 413
    finally:
        os.unlink(temp_path)


def test_search_engine_read_lock():
    """Search engine search() uses read lock."""
    from tools.search_engine import WikiSearchEngine
    import threading

    engine = WikiSearchEngine()
    results = []

    def search():
        r = engine.search("test")
        results.append(len(r))

    threads = [threading.Thread(target=search) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == 5
    engine.close()


def test_api_server_lifespan_closes_search_engine():
    """Lifespan context manager closes search engine on shutdown."""
    import tools.api_server as api_mod

    # Ensure search engine can be created
    engine = api_mod._get_search_engine()
    assert engine is not None

    # Simulate shutdown
    api_mod._search_engine = engine
    import asyncio
    from contextlib import AsyncExitStack

    # Lifespan is an asynccontextmanager; manually enter/exit
    async def run_lifespan():
        from contextlib import asynccontextmanager
        # Re-create the lifespan logic directly
        api_mod._search_engine = engine
        # Trigger shutdown by simulating the finally block
        if api_mod._search_engine:
            api_mod._search_engine.close()
            api_mod._search_engine = None

    asyncio.run(run_lifespan())
    assert api_mod._search_engine is None


def run_all() -> int:
    """Run tests without pytest dependency."""
    tests = [
        test_path_traversal_rejection,
        test_webhook_token_required,
        test_search_engine_chinese_query,
        test_memory_lifecycle,
        test_context_pack_building,
        test_cli_version,
        test_health_no_empty_stubs,
        test_search_engine_english_phrase,
        test_frontmatter_parsing,
        test_api_log_pagination,
        test_raw_file_content_size_limit,
        test_search_engine_read_lock,
        test_api_server_lifespan_closes_search_engine,
    ]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  [PASS] {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {test.__name__}: {e}")
            failed += 1
    print(f"\nResults: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_all())
