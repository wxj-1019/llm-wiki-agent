#!/usr/bin/env python3
"""Export the unified graph to external formats (GraphML, CSV, Cypher)."""
from __future__ import annotations

import csv
import json
from io import StringIO
from pathlib import Path
from typing import Any

try:
    import networkx as nx
    HAS_NX = True
except ImportError:
    HAS_NX = False

REPO_ROOT = Path(__file__).parent.parent.parent
GRAPH_JSON = REPO_ROOT / "graph" / "graph.json"


def _load_graph(path: Path | None = None) -> tuple[list[dict], list[dict]]:
    p = path or GRAPH_JSON
    data = json.loads(p.read_text(encoding="utf-8"))
    return data.get("nodes", []), data.get("edges", [])


def export_graphml(path: Path | None = None, out_path: Path | None = None) -> str:
    """Export graph to GraphML (Gephi / Cytoscape compatible)."""
    if not HAS_NX:
        raise RuntimeError("networkx required for GraphML export")
    nodes, edges = _load_graph(path)
    G = nx.DiGraph()
    for n in nodes:
        nid = n.get("id")
        if nid is None:
            continue
        # Flatten extra fields for GraphML compatibility
        attrs = {}
        for k, v in n.items():
            if k == "id":
                continue
            if isinstance(v, (str, int, float, bool)):
                attrs[k] = v
            else:
                attrs[k] = str(v)
        G.add_node(nid, **attrs)
    for e in edges:
        src = e.get("from") or e.get("source")
        tgt = e.get("to") or e.get("target")
        if not src or not tgt:
            continue
        attrs = {}
        for k, v in e.items():
            if k in ("from", "to", "source", "target"):
                continue
            if isinstance(v, (str, int, float, bool)):
                attrs[k] = v
            else:
                attrs[k] = str(v)
        G.add_edge(src, tgt, **attrs)

    dest = out_path or (REPO_ROOT / "graph" / "graph.graphml")
    nx.write_graphml(G, str(dest))
    return str(dest)


def export_csv(path: Path | None = None, out_dir: Path | None = None) -> dict[str, str]:
    """Export nodes and edges as separate CSV files."""
    nodes, edges = _load_graph(path)
    out = out_dir or (REPO_ROOT / "graph")
    out.mkdir(parents=True, exist_ok=True)

    node_file = out / "graph_nodes.csv"
    edge_file = out / "graph_edges.csv"

    # Nodes CSV (streaming to keep memory low)
    if nodes:
        keys = sorted({k for n in nodes for k in n.keys()})
        with node_file.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for n in nodes:
                writer.writerow({k: n.get(k, "") for k in keys})

    # Edges CSV
    if edges:
        keys = sorted({k for e in edges for k in e.keys()})
        with edge_file.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for e in edges:
                writer.writerow({k: e.get(k, "") for k in keys})

    return {"nodes_csv": str(node_file), "edges_csv": str(edge_file)}


def export_cypher(path: Path | None = None) -> str:
    """Generate Neo4j Cypher statements."""
    nodes, edges = _load_graph(path)
    lines: list[str] = []
    lines.append("// Auto-generated Cypher from LLM Wiki Agent graph")
    lines.append("")

    # Create nodes
    for n in nodes:
        nid = n.get("id", "").replace("'", "\\'")
        label = n.get("label", nid).replace("'", "\\'")
        ntype = n.get("type", "Node").replace("'", "\\'")
        # Use type as label, fallback to Node
        cypher_label = ntype if ntype.isalpha() else "Node"
        props = {"id": nid, "label": label}
        if "language" in n:
            props["language"] = n["language"]
        if "path" in n:
            props["path"] = n["path"]
        if "group" in n:
            props["community"] = n["group"]
        prop_str = ", ".join(f"{k}: '{v}'" for k, v in props.items())
        lines.append(f"CREATE ({nid.replace('-', '_').replace('/', '_').replace('.', '_')}:{cypher_label} {{{prop_str}}})")

    lines.append("")
    # Create edges
    for e in edges:
        src = e.get("from") or e.get("source", "")
        tgt = e.get("to") or e.get("target", "")
        etype = e.get("type", e.get("edge_type", "RELATES_TO")).upper().replace(" ", "_")
        if not src or not tgt:
            continue
        src_var = src.replace("-", "_").replace("/", "_").replace(".", "_")
        tgt_var = tgt.replace("-", "_").replace("/", "_").replace(".", "_")
        lines.append(f"MATCH (a), (b) WHERE a.id = '{src}' AND b.id = '{tgt}' CREATE (a)-[:{etype}]->(b)")

    return "\n".join(lines)


def export_all(path: Path | None = None, out_dir: Path | None = None) -> dict[str, str]:
    """Run all exporters and return paths."""
    results = {}
    if HAS_NX:
        try:
            results["graphml"] = export_graphml(path, out_dir and (out_dir / "graph.graphml"))
        except Exception as exc:
            results["graphml_error"] = str(exc)
    try:
        results.update(export_csv(path, out_dir))
    except Exception as exc:
        results["csv_error"] = str(exc)
    try:
        cypher = export_cypher(path)
        cypher_path = (out_dir or (REPO_ROOT / "graph")) / "graph.cypher"
        cypher_path.write_text(cypher, encoding="utf-8")
        results["cypher"] = str(cypher_path)
    except Exception as exc:
        results["cypher_error"] = str(exc)
    return results
