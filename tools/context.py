#!/usr/bin/env python3
"""Context Pack Builder — assemble token-bounded context from wiki knowledge.

Usage:
    python tools/context.py build "Design auth system" --target wiki/concepts/Auth.md --budget 8000
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
GRAPH = REPO / "graph" / "graph.json"

def _estimate_tokens(text: str) -> int:
    """Estimate token count without external deps.

    Heuristic:
    - CJK characters: ~1.5 chars/token (most tokenizers encode CJK at ~1-2 chars per token)
    - English/ASCII: ~4 chars/token
    - Mixed: weighted average
    """
    cjk = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other = len(text) - cjk
    return max(1, int(cjk / 1.5 + other / 4))


def _strip_frontmatter(text: str) -> str:
    m = re.match(r"^---\n.*?\n---\n", text, re.DOTALL)
    return text[m.end():] if m else text


def _read_page(rel_path: str) -> tuple[str, str, str] | None:
    """Read a wiki page. Returns (path, title, body) or None."""
    target = (REPO / rel_path).resolve()
    if not str(target).startswith(str(WIKI.resolve())):
        return None
    if not target.exists():
        return None
    try:
        content = target.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    title_match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.M)
    title = title_match.group(1).strip() if title_match else target.stem
    body = _strip_frontmatter(content).strip()
    return str(target.relative_to(REPO)), title, body


def _graph_neighbors(target_path: str, depth: int = 2) -> list[str]:
    """Traverse graph.json to find related node paths."""
    if not GRAPH.exists():
        return []
    try:
        data = json.loads(GRAPH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    nodes = {n.get("id", n.get("label", "")): n for n in data.get("nodes", [])}
    edges = data.get("edges", [])

    target_id = Path(target_path).stem
    visited = {target_id}
    frontier = {target_id}
    results = []

    for _ in range(depth):
        next_frontier = set()
        for edge in edges:
            src = edge.get("from", edge.get("source", ""))
            dst = edge.get("to", edge.get("target", ""))
            for node_id in list(frontier):
                if node_id in (src, dst):
                    other = dst if node_id == src else src
                    if other not in visited:
                        visited.add(other)
                        next_frontier.add(other)
                        node = nodes.get(other)
                        if node:
                            path = node.get("path", "")
                            if path and path not in results:
                                results.append(path)
        frontier = next_frontier
        if not frontier:
            break

    return results


def _fts_search(query: str, limit: int = 20) -> list[dict]:
    """FTS5 search via search_engine.py."""
    try:
        from tools.search_engine import WikiSearchEngine

        engine = WikiSearchEngine()
        results = engine.search(query, limit)
        engine.close()
        return results
    except Exception:
        return []


def build(
    goal: str,
    target: str | None = None,
    budget: int = 8000,
    depth: int = 2,
) -> str:
    collected: list[dict] = []
    used_paths = set()

    if target:
        page = _read_page(target)
        if page:
            path, title, body = page
            used_paths.add(path)
            collected.append({
                "path": path,
                "title": title,
                "body": body[:2000],
                "source": "target",
                "relevance": 1.0,
            })

    if target:
        neighbors = _graph_neighbors(target, depth)
        for rel_path in neighbors:
            if rel_path in used_paths:
                continue
            page = _read_page(rel_path)
            if not page:
                continue
            path, title, body = page
            used_paths.add(path)
            collected.append({
                "path": path,
                "title": title,
                "body": body[:1500],
                "source": "graph",
                "relevance": 0.8,
            })

    fts_results = _fts_search(goal, limit=30)
    for r in fts_results:
        path = r.get("path", "")
        if path in used_paths:
            continue
        page = _read_page(path)
        if not page:
            continue
        _, title, body = page
        used_paths.add(path)
        collected.append({
            "path": path,
            "title": title,
            "body": body[:1200],
            "source": "fts",
            "relevance": 0.6,
        })

    def _sort_key(e: dict) -> tuple:
        try:
            p = REPO / e["path"]
            mtime = p.stat().st_mtime
        except OSError:
            mtime = 0
        return (-e["relevance"], -mtime)

    collected.sort(key=_sort_key)

    final: list[dict] = []
    tokens_used = 0
    for e in collected:
        est = _estimate_tokens(e["body"])
        if tokens_used + est > budget:
            remaining = budget - tokens_used
            if remaining > 50:
                ratio = remaining / est
                e = {**e, "body": e["body"][:int(len(e["body"]) * ratio)]}
                est = _estimate_tokens(e["body"])
            else:
                break
        final.append(e)
        tokens_used += est

    lines = [
        f"# Context Pack: {goal}",
        "",
        f"**Budget**: {budget} tokens | **Pages**: {len(final)} | **Estimated**: {tokens_used} tokens",
        "",
        "## Pages",
        "",
    ]

    for e in final:
        lines.append(f"### {e['title']} ({e['source']})")
        lines.append(f"*Path*: `{e['path']}`")
        lines.append("")
        lines.append(e["body"])
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def save_pack(goal: str, target: str | None, budget: int, depth: int) -> Path:
    """Build and save a context pack to wiki/memory/context-packs/."""
    pack_dir = REPO / "wiki" / "memory" / "context-packs"
    pack_dir.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^\w\s-]", "", goal).strip().replace(" ", "-")[:40]
    timestamp = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"pack-{slug}-{timestamp}.md"
    path = pack_dir / filename

    content = build(goal, target, budget, depth)
    header = f"""---
title: "Context Pack: {goal}"
type: synthesis
tags: [context-pack, memory]
date: {__import__('datetime').datetime.now().strftime('%Y-%m-%d')}
goal: "{goal}"
target: "{target or ''}"
budget: {budget}
---

"""
    path.write_text(header + content, encoding="utf-8")
    print(f"Saved context pack to {path.relative_to(REPO)}")
    return path


# ── CLI ──

def main() -> int:
    parser = argparse.ArgumentParser(description="Context Pack Builder")
    sub = parser.add_subparsers(dest="cmd")

    p_build = sub.add_parser("build", help="Build a context pack")
    p_build.add_argument("goal")
    p_build.add_argument("--target", default=None)
    p_build.add_argument("--budget", type=int, default=8000)
    p_build.add_argument("--depth", type=int, default=2)
    p_build.add_argument("--save", action="store_true", help="Save to wiki/memory/context-packs/")

    args = parser.parse_args()

    if args.cmd == "build":
        if args.save:
            save_pack(args.goal, args.target, args.budget, args.depth)
        else:
            print(build(args.goal, args.target, args.budget, args.depth))
    else:
        parser.print_help()
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
