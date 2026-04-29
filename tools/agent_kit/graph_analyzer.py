#!/usr/bin/env python3
"""Analyze knowledge graph for entity/concept ranking."""
from __future__ import annotations

import logging
from collections import defaultdict, deque
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.types import GraphAnalysis, GraphNode, WikiPage

logger = logging.getLogger(__name__)


def analyze_graph(graph_data: dict, pages: dict[str, WikiPage]) -> GraphAnalysis:
    """Analyze graph and return enriched node information."""
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])

    # Build adjacency list
    adj: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if src and tgt:
            adj[src].append(tgt)
            adj[tgt].append(src)

    # Compute degree centrality
    node_degrees: dict[str, int] = defaultdict(int)
    for edge in edges:
        node_degrees[edge.get("source", "")] += 1
        node_degrees[edge.get("target", "")] += 1

    # Approximate betweenness centrality using sampled pairs
    betweenness = _approximate_betweenness(adj, sample_limit=200)

    max_btw = max(betweenness.values()) if betweenness else 1.0
    if max_btw == 0:
        max_btw = 1.0

    enriched_nodes: dict[str, GraphNode] = {}
    for node in nodes:
        nid = node.get("id", "")
        enriched_nodes[nid] = {
            **node,  # type: ignore[typeddict-item]
            "degree": node_degrees.get(nid, 0),
            "betweenness": betweenness.get(nid, 0.0) / max_btw,
        }

    # Include page slugs that exist in pages but not in graph nodes
    for slug, page in pages.items():
        if slug not in enriched_nodes:
            enriched_nodes[slug] = {
                "id": slug,
                "label": page["title"],
                "type": page["type"],
                "degree": 0,
                "betweenness": 0.0,
            }

    return {
        "nodes": enriched_nodes,
        "edges": edges,
        "communities": graph_data.get("communities", {}),
    }


def _approximate_betweenness(
    adj: dict[str, list[str]], sample_limit: int = 200
) -> dict[str, float]:
    """Approximate betweenness centrality by sampling shortest paths.

    For small graphs (< 500 nodes) this computes exact betweenness.
    For larger graphs it samples node pairs to keep runtime reasonable.
    """
    nodes = list(adj.keys())
    betweenness: dict[str, float] = defaultdict(float)

    if len(nodes) <= 2:
        return dict(betweenness)

    # Determine sample size
    total_pairs = len(nodes) * (len(nodes) - 1) // 2
    import itertools
    import random

    all_pairs = list(itertools.combinations(nodes, 2))
    if len(all_pairs) > sample_limit:
        pairs = random.sample(all_pairs, sample_limit)
    else:
        pairs = all_pairs

    for src, tgt in pairs:
        path = _bfs_path(adj, src, tgt)
        if path and len(path) > 2:
            for node in path[1:-1]:
                betweenness[node] += 1.0

    return dict(betweenness)


def _bfs_path(adj: dict[str, list[str]], start: str, end: str, max_depth: int = 4) -> list[str] | None:
    """Find shortest path between two nodes using BFS."""
    if start == end:
        return [start]
    visited: set[str] = {start}
    queue: deque[tuple[str, list[str]]] = deque([(start, [start])])
    while queue:
        node, path = queue.popleft()
        if len(path) >= max_depth:
            continue
        for neighbor in adj.get(node, []):
            if neighbor == end:
                return path + [neighbor]
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))
    return None
