#!/usr/bin/env python3
"""Content triage: classify pages into priority tiers."""
from __future__ import annotations


def triage_pages(pages, graph_analysis, config):
    """Triage pages into P0/P1/P2 tiers.

    Returns a dict with 'p0', 'p1', 'p2' keys containing page dicts.
    """
    nodes = graph_analysis.get("nodes", {})
    min_length = config.get("page_min_length", 300)

    # P0: overview + high-centrality nodes
    p0_slugs = {"overview"}
    sorted_by_degree = sorted(
        nodes.items(),
        key=lambda x: x[1].get("degree", 0),
        reverse=True,
    )
    top_n = config.get("max_entities", 10) + config.get("max_concepts", 10)
    for slug, _ in sorted_by_degree[:top_n]:
        p0_slugs.add(slug)

    p0 = {s: pages[s] for s in p0_slugs if s in pages}
    p1 = {}
    p2 = {}

    for slug, page in pages.items():
        if slug in p0_slugs:
            continue
        if page.get("body_length", 0) >= min_length:
            p1[slug] = page
        else:
            p2[slug] = page

    return {"p0": p0, "p1": p1, "p2": p2}
