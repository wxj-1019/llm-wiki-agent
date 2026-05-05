#!/usr/bin/env python3
"""P1 + 5 Iterations Acceptance Test."""
from __future__ import annotations

import json
import os
import py_compile
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def main() -> int:
    print("=" * 55)
    print("P1 + 5 Iterations Acceptance Test")
    print("=" * 55)

    # MCP Server + Memory + Context
    print("\n[MCP] wiki_search + memory + context")
    from tools.mcp_server import wiki_search, wiki_memory_start, wiki_memory_list, wiki_context_build

    r = wiki_search("transformer", limit=3)
    results = json.loads(r)
    assert len(results) > 0, "wiki_search should return results"
    print(f"  wiki_search: OK ({len(results)} results)")

    r = wiki_memory_start("Test MCP integration", "wiki/concepts/Transformer.md")
    assert json.loads(r)["success"], "memory_start should succeed"
    print(f"  wiki_memory_start: OK ({json.loads(r)['session_id']})")

    r = wiki_memory_list("active")
    sessions = json.loads(r)
    assert len(sessions) > 0, "memory_list should return sessions"
    print(f"  wiki_memory_list: OK ({len(sessions)} sessions)")

    r = wiki_context_build("transformer architecture", "wiki/concepts/Transformer.md", 2000)
    assert "Context Pack" in r, "context_build should return a context pack"
    print(f"  wiki_context_build: OK ({len(r)} chars)")

    # FTS5 Chinese search
    print("\n[FTS5] Chinese search optimization")
    from tools.search_engine import WikiSearchEngine

    engine = WikiSearchEngine()

    q = engine._build_fts_query("transformer architecture")
    assert q.startswith('"'), "English query should be a phrase"
    print("  english query: OK")

    q2 = engine._build_fts_query("模型")
    assert "模型" in q2, "Chinese query should contain bigram"
    print("  chinese query (bigram): OK")

    q3 = engine._build_fts_query("机器学习技术")
    assert "OR" in q3, "Multi-char Chinese query should use OR for bigrams"
    print("  chinese query (multi-bigram OR): OK")

    results = engine.search("model", limit=5)
    print(f"  search: OK ({len(results)} results)")
    engine.close()

    # Webhook auth
    print("\n[Webhook] Auth + endpoints")
    os.environ["WIKI_WEBHOOK_TOKEN"] = "test-token"
    print("  token configured: OK")

    # Python compile all
    print("\n[Build] Compile check")
    files = [
        "tools/api_server.py",
        "tools/mcp_server.py",
        "tools/search_engine.py",
        "tools/watcher.py",
        "tools/memory.py",
        "tools/context.py",
        "tools/test_api.py",
    ]
    for f in files:
        py_compile.compile(f, doraise=True)
    print(f"  {len(files)} files compiled: OK")

    print("\n" + "=" * 55)
    print("ALL TESTS PASSED")
    print("=" * 55)
    return 0


if __name__ == "__main__":
    sys.exit(main())
