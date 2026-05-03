#!/usr/bin/env python3
"""Wiki Search MCP Server — 搜索 wiki 知识库中的内容."""
from __future__ import annotations

import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent
WIKI = REPO / "wiki"

mcp = FastMCP("wiki-search")


@mcp.tool()
def search_wiki(query: str) -> str:
    """搜索 wiki 知识库中的内容，返回匹配的页面列表."""
    results = []
    q = query.lower()
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if q in content.lower():
            rel = p.relative_to(WIKI)
            preview = content[:200].replace("\n", " ")
            results.append({"id": str(rel.with_suffix("")), "preview": preview})
    return json.dumps(results[:20], ensure_ascii=False)


@mcp.tool()
def get_page(page_type: str, slug: str) -> str:
    """获取 wiki 页面的完整 markdown 内容."""
    path = WIKI / page_type / f"{slug}.md"
    if not path.exists() or not path.is_relative_to(WIKI):
        return json.dumps({"error": f"Page not found: {page_type}/{slug}"})
    return path.read_text(encoding="utf-8")


@mcp.tool()
def list_pages(page_type: str = "") -> str:
    """列出 wiki 页面，可按类型过滤（sources/entities/concepts/syntheses）."""
    search_dir = WIKI / page_type if page_type else WIKI
    if not search_dir.exists():
        return json.dumps({"error": f"Invalid type: {page_type}"})
    pages = []
    for p in search_dir.rglob("*.md"):
        if p.name in ("index.md", "log.md"):
            continue
        rel = p.relative_to(WIKI)
        pages.append(str(rel.with_suffix("")))
    return json.dumps(pages, ensure_ascii=False)


@mcp.tool()
def get_graph() -> str:
    """获取知识图谱的节点和边数据."""
    graph_path = REPO / "graph" / "graph.json"
    if not graph_path.exists():
        return json.dumps({"error": "Graph not built yet. Run build_graph first."})
    return graph_path.read_text(encoding="utf-8")


if __name__ == "__main__":
    mcp.run()
