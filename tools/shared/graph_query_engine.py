#!/usr/bin/env python3
"""Graph query engine — natural-language-ish graph traversal over graph.json."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    import networkx as nx
    HAS_NX = True
except ImportError:
    HAS_NX = False

REPO_ROOT = Path(__file__).parent.parent.parent
GRAPH_JSON = REPO_ROOT / "graph" / "graph.json"


class GraphQueryEngine:
    """Load graph.json and answer structured queries."""

    def __init__(self, graph_path: Path | None = None) -> None:
        self.graph_path = graph_path or GRAPH_JSON
        self._nodes: list[dict] = []
        self._edges: list[dict] = []
        self._G: Any = None
        self._node_index: dict[str, dict] = {}
        self._community_map: dict[str, int] = {}
        self._label_index: dict[str, str] = {}  # label (lower) -> id
        self._loaded = False
        self._load_mtime: float = 0.0

    # ── Loading ──

    def load(self, force: bool = False) -> None:
        if self._loaded and not force:
            # Auto-reload if graph.json changed
            try:
                mtime = self.graph_path.stat().st_mtime
            except OSError:
                mtime = 0
            if mtime == self._load_mtime:
                return
        if not self.graph_path.exists():
            raise FileNotFoundError(f"Graph not found: {self.graph_path}")
        data = json.loads(self.graph_path.read_text(encoding="utf-8"))
        self._nodes = data.get("nodes", [])
        self._edges = data.get("edges", [])
        self._node_index = {n["id"]: n for n in self._nodes}
        self._community_map = {n["id"]: n.get("group", -1) for n in self._nodes}
        self._label_index = {
            n.get("label", n["id"]).lower(): n["id"]
            for n in self._nodes
            if n.get("label")
        }
        if HAS_NX:
            self._G = nx.DiGraph()
            for n in self._nodes:
                self._G.add_node(n["id"], **{k: v for k, v in n.items() if k != "id"})
            for e in self._edges:
                src = e.get("from") or e.get("source")
                tgt = e.get("to") or e.get("target")
                if src and tgt:
                    self._G.add_edge(src, tgt, **e)
        self._loaded = True
        try:
            self._load_mtime = self.graph_path.stat().st_mtime
        except OSError:
            self._load_mtime = 0

    def _ensure(self) -> None:
        if not self._loaded:
            self.load()

    def reload(self) -> None:
        """Force reload graph.json from disk."""
        self._loaded = False
        self.load(force=True)

    # ── Intention parsing ──

    @staticmethod
    def parse_intent(text: str) -> dict[str, Any]:
        """Parse a free-text query into a structured intent.

        Supported patterns:
            path <A> <B>          → shortest path between two nodes
            neighbors <A>         → 1-hop neighbors of node A
            explain <A>           → metadata summary for node A
            community <N|name>    → nodes in community N
            query <keyword>       → fuzzy search across nodes/edges
            calls <A>             → nodes that A calls / imports
            called_by <A>         → nodes that call / import A
        """
        t = text.strip().lower()

        # path
        m = re.match(r"path\s+(\S+)\s+(\S+)", t)
        if m:
            return {"intent": "path", "source": m.group(1), "target": m.group(2)}

        # neighbors
        m = re.match(r"neighbors?\s+(\S+)", t)
        if m:
            return {"intent": "neighbors", "node": m.group(1)}

        # explain
        m = re.match(r"explain\s+(\S+)", t)
        if m:
            return {"intent": "explain", "node": m.group(1)}

        # community
        m = re.match(r"community\s+(\S+)", t)
        if m:
            return {"intent": "community", "id": m.group(1)}

        # calls / imports from
        m = re.match(r"calls?\s+(\S+)", t)
        if m:
            return {"intent": "calls", "node": m.group(1)}

        # called_by / imported_by
        m = re.match(r"called_by\s+(\S+)", t)
        if m:
            return {"intent": "called_by", "node": m.group(1)}

        # fallback: keyword search
        return {"intent": "query", "keyword": text.strip()}

    # ── Execution ──

    def execute(self, text: str) -> dict[str, Any]:
        self._ensure()
        # Simple query cache keyed by raw text + graph mtime
        cache_key = f"{text}::{self._load_mtime}"
        if hasattr(self, "_query_cache") and cache_key in self._query_cache:
            return self._query_cache[cache_key]
        intent = self.parse_intent(text)
        handler = {
            "path": self._do_path,
            "neighbors": self._do_neighbors,
            "explain": self._do_explain,
            "community": self._do_community,
            "calls": self._do_calls,
            "called_by": self._do_called_by,
            "query": self._do_query,
        }.get(intent["intent"], self._do_query)
        result = handler(**{k: v for k, v in intent.items() if k != "intent"})
        if not hasattr(self, "_query_cache"):
            self._query_cache: dict[str, Any] = {}
        self._query_cache[cache_key] = result
        # Limit cache size
        if len(self._query_cache) > 256:
            self._query_cache.clear()
        return result

    # ── Handlers ──

    def _do_path(self, source: str, target: str) -> dict[str, Any]:
        if not HAS_NX:
            return {"error": "networkx not installed"}
        # Fuzzy match node ids
        src = self._fuzzy_match(source)
        tgt = self._fuzzy_match(target)
        if not src:
            return {"error": f"Source node not found: {source}"}
        if not tgt:
            return {"error": f"Target node not found: {target}"}
        try:
            sp = nx.shortest_path(self._G.to_undirected(), src, tgt)
            path_nodes = [self._node_index.get(n, {"id": n}) for n in sp]
            path_edges = []
            for i in range(len(sp) - 1):
                edge_data = self._G.get_edge_data(sp[i], sp[i + 1])
                path_edges.append(edge_data or {"from": sp[i], "to": sp[i + 1]})
            return {
                "intent": "path",
                "source": src,
                "target": tgt,
                "length": len(sp) - 1,
                "nodes": path_nodes,
                "edges": path_edges,
            }
        except nx.NetworkXNoPath:
            return {"error": f"No path between {src} and {tgt}"}

    def _do_neighbors(self, node: str, hops: int = 1) -> dict[str, Any]:
        if not HAS_NX:
            return {"error": "networkx not installed"}
        nid = self._fuzzy_match(node)
        if not nid:
            return {"error": f"Node not found: {node}"}
        if hops == 1:
            neighbors = set(self._G.predecessors(nid)) | set(self._G.successors(nid))
        else:
            # Multi-hop BFS
            seen = {nid}
            frontier = {nid}
            for _ in range(hops):
                nxt = set()
                for n in frontier:
                    nxt |= set(self._G.predecessors(n)) | set(self._G.successors(n))
                frontier = nxt - seen
                seen |= frontier
            neighbors = seen - {nid}
        return {
            "intent": "neighbors",
            "node": nid,
            "hops": hops,
            "count": len(neighbors),
            "nodes": [self._node_index.get(n, {"id": n}) for n in neighbors],
        }

    def _do_explain(self, node: str) -> dict[str, Any]:
        nid = self._fuzzy_match(node)
        if not nid:
            return {"error": f"Node not found: {node}"}
        n = self._node_index.get(nid, {})
        in_degree = len([e for e in self._edges if e.get("to") == nid or e.get("target") == nid])
        out_degree = len([e for e in self._edges if e.get("from") == nid or e.get("source") == nid])
        comm = self._community_map.get(nid, -1)
        comm_size = sum(1 for c in self._community_map.values() if c == comm) if comm >= 0 else 0
        return {
            "intent": "explain",
            "node": nid,
            "label": n.get("label", nid),
            "type": n.get("type", "unknown"),
            "language": n.get("language", ""),
            "path": n.get("path", ""),
            "community": comm,
            "community_size": comm_size,
            "in_degree": in_degree,
            "out_degree": out_degree,
            "degree": in_degree + out_degree,
        }

    def _do_community(self, id: str) -> dict[str, Any]:
        try:
            comm_id = int(id)
        except ValueError:
            # Try to find by node label
            nid = self._fuzzy_match(id)
            if not nid:
                return {"error": f"Community or node not found: {id}"}
            comm_id = self._community_map.get(nid, -1)
        if comm_id < 0:
            return {"error": f"No community assigned for: {id}"}
        members = [n for n in self._nodes if n.get("group") == comm_id]
        return {
            "intent": "community",
            "community": comm_id,
            "count": len(members),
            "nodes": members,
        }

    def _do_calls(self, node: str) -> dict[str, Any]:
        """Outgoing edges (calls, imports, contains)."""
        nid = self._fuzzy_match(node)
        if not nid:
            return {"error": f"Node not found: {node}"}
        outgoing = [
            e for e in self._edges
            if (e.get("from") == nid or e.get("source") == nid)
        ]
        targets = {e.get("to", e.get("target", "")) for e in outgoing}
        return {
            "intent": "calls",
            "node": nid,
            "count": len(outgoing),
            "edges": outgoing,
            "targets": [self._node_index.get(t, {"id": t}) for t in targets if t],
        }

    def _do_called_by(self, node: str) -> dict[str, Any]:
        """Incoming edges (called_by, imported_by)."""
        nid = self._fuzzy_match(node)
        if not nid:
            return {"error": f"Node not found: {node}"}
        incoming = [
            e for e in self._edges
            if (e.get("to") == nid or e.get("target") == nid)
        ]
        sources = {e.get("from", e.get("source", "")) for e in incoming}
        return {
            "intent": "called_by",
            "node": nid,
            "count": len(incoming),
            "edges": incoming,
            "sources": [self._node_index.get(s, {"id": s}) for s in sources if s],
        }

    def _do_query(self, keyword: str) -> dict[str, Any]:
        kw = keyword.lower()
        matched_nodes = [n for n in self._nodes if kw in n.get("label", "").lower() or kw in n.get("id", "").lower()]
        matched_edges = [e for e in self._edges if kw in str(e).lower()]
        return {
            "intent": "query",
            "keyword": keyword,
            "node_count": len(matched_nodes),
            "edge_count": len(matched_edges),
            "nodes": matched_nodes[:50],
            "edges": matched_edges[:50],
        }

    # ── Fuzzy matching ──

    def _fuzzy_match(self, text: str) -> str | None:
        """Try exact, then case-insensitive, then partial match."""
        t = text.strip()
        # 1. exact id
        if t in self._node_index:
            return t
        # 2. case-insensitive id (fast via precomputed label index)
        if t.lower() in self._label_index:
            return self._label_index[t.lower()]
        # 3. partial id/label/path match
        candidates: list[tuple[int, str]] = []
        t_lower = t.lower()
        for k, v in self._node_index.items():
            score = 0
            if t_lower in k.lower():
                score += 10
            if t_lower in v.get("label", "").lower():
                score += 10
            if t_lower in v.get("path", "").lower():
                score += 5
            if score:
                candidates.append((score, k))
        if candidates:
            candidates.sort(key=lambda x: (-x[0], x[1]))
            return candidates[0][1]
        return None


# ── CLI convenience ──

def main() -> None:
    import sys
    engine = GraphQueryEngine()
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "explain code/tools/api_server"
    result = engine.execute(query)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
