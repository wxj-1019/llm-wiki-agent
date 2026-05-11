#!/usr/bin/env python3
"""CLI for querying the unified knowledge graph.

Usage:
    python tools/graph_query.py "path code/tools/api_server code/tools/build_graph"
    python tools/graph_query.py "neighbors code/tools/api_server"
    python tools/graph_query.py "explain api_server"
    python tools/graph_query.py "community 12"
    python tools/graph_query.py "calls code/tools/build_graph"
    python tools/graph_query.py "called_by code/tools/api_server"
    python tools/graph_query.py "fastapi"
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
_repo_root_str = str(REPO_ROOT)
if _repo_root_str not in sys.path:
    sys.path.insert(0, _repo_root_str)

from tools.shared.graph_query_engine import GraphQueryEngine


def format_result(result: dict) -> str:
    intent = result.get("intent", "unknown")
    lines: list[str] = []

    if "error" in result:
        return f"Error: {result['error']}"

    if intent == "path":
        lines.append(f"Path ({result['length']} hops): {result['source']} -> {result['target']}")
        for n in result.get("nodes", []):
            lines.append(f"  - {n.get('label', n['id'])}  ({n.get('type', '')})")

    elif intent == "neighbors":
        lines.append(f"Neighbors of {result['node']} ({result['count']} total):")
        for n in result.get("nodes", [])[:20]:
            lines.append(f"  - {n.get('label', n['id'])}  ({n.get('type', '')})")
        if result["count"] > 20:
            lines.append(f"  ... and {result['count'] - 20} more")

    elif intent == "explain":
        lines.append(f"Node: {result['node']}")
        lines.append(f"  Label:    {result['label']}")
        lines.append(f"  Type:     {result['type']}")
        lines.append(f"  Language: {result['language'] or 'n/a'}")
        lines.append(f"  Path:     {result['path'] or 'n/a'}")
        lines.append(f"  Community: {result['community']} (size {result['community_size']})")
        lines.append(f"  Degree:   {result['degree']} (in={result['in_degree']}, out={result['out_degree']})")

    elif intent == "community":
        lines.append(f"Community {result['community']} ({result['count']} nodes):")
        for n in result.get("nodes", [])[:30]:
            lines.append(f"  - {n.get('label', n['id'])}  ({n.get('type', '')})")
        if result["count"] > 30:
            lines.append(f"  ... and {result['count'] - 30} more")

    elif intent in ("calls", "called_by"):
        verb = "calls" if intent == "calls" else "called by"
        lines.append(f"{result['node']} {verb} ({result['count']} edges):")
        targets = result.get("targets" if intent == "calls" else "sources", [])
        for t in targets[:20]:
            lines.append(f"  - {t.get('label', t['id'])}  ({t.get('type', '')})")
        if result["count"] > 20:
            lines.append(f"  ... and {result['count'] - 20} more")

    elif intent == "query":
        lines.append(f"Query '{result['keyword']}' -> {result['node_count']} nodes, {result['edge_count']} edges")
        for n in result.get("nodes", [])[:15]:
            lines.append(f"  - {n.get('label', n['id'])}  ({n.get('type', '')})")

    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    engine = GraphQueryEngine()
    result = engine.execute(query)
    print(format_result(result))


if __name__ == "__main__":
    main()
