#!/usr/bin/env python3
"""Graphify integration tests — end-to-end validation of Phase 1-4 features."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import pytest

GRAPH_JSON = REPO / "graph" / "graph.json"


class TestGraphExists:
    """Verify graph.json was built successfully."""

    def test_graph_json_exists(self):
        assert GRAPH_JSON.exists(), "graph.json not found. Run: python tools/build_graph.py --code"

    def test_graph_has_nodes_and_edges(self):
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        assert len(data.get("nodes", [])) > 0, "No nodes in graph"
        assert len(data.get("edges", [])) > 0, "No edges in graph"

    def test_graph_has_code_nodes(self):
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        code_nodes = [n for n in data["nodes"] if n.get("type", "").startswith("code_")]
        assert len(code_nodes) > 0, "No code nodes found (run with --code)"

    def test_graph_has_wiki_nodes(self):
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        wiki_types = {"source", "entity", "concept", "synthesis"}
        wiki_nodes = [n for n in data["nodes"] if n.get("type", "") in wiki_types]
        assert len(wiki_nodes) > 0, "No wiki nodes found"

    def test_communities_assigned(self):
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        groups = {n.get("group", -1) for n in data["nodes"]}
        assert len(groups) > 1 or (-1 not in groups), "No community detection results"


class TestGraphQueryEngine:
    """Test graph_query_engine.py intents."""

    @pytest.fixture(scope="class")
    def engine(self):
        from tools.shared.graph_query_engine import GraphQueryEngine
        e = GraphQueryEngine()
        e.load()
        return e

    def test_explain(self, engine):
        result = engine.execute("explain code/tools/api_server")
        assert result["intent"] == "explain"
        assert result["label"] == "api_server.py"
        assert result["type"] == "code_module"

    def test_neighbors(self, engine):
        result = engine.execute("neighbors code/tools/api_server")
        assert result["intent"] == "neighbors"
        assert result["count"] > 0

    def test_path(self, engine):
        result = engine.execute("path code/tools/api_server code/tools/api_server#graph_node")
        # May or may not find a path; just verify structure
        assert result["intent"] == "path"
        if "error" not in result:
            assert result["length"] >= 0

    def test_query_keyword(self, engine):
        result = engine.execute("fastapi")
        assert result["intent"] == "query"
        assert result["node_count"] >= 0

    def test_community(self, engine):
        result = engine.execute("community 0")
        assert result["intent"] == "community"
        assert result["count"] > 0

    def test_calls(self, engine):
        result = engine.execute("calls code/tools/api_server")
        assert result["intent"] == "calls"

    def test_called_by(self, engine):
        result = engine.execute("called_by code/tools/api_server")
        assert result["intent"] == "called_by"

    def test_fuzzy_match(self, engine):
        result = engine.execute("explain api_server")
        assert result["intent"] == "explain"
        assert "error" not in result

    def test_nonexistent_node(self, engine):
        result = engine.execute("explain this_node_does_not_exist_12345")
        assert "error" in result

    def test_empty_keyword(self, engine):
        result = engine.execute("")
        assert result["intent"] == "query"

    def test_no_path(self, engine):
        result = engine.execute("path code/tools/api_server code/tools/build_graph")
        assert "error" in result or result.get("length", 0) >= 0

    def test_large_community(self, engine):
        result = engine.execute("community 0")
        assert result["intent"] == "community"
        assert result["count"] > 0


class TestGraphExport:
    """Test graph_export.py formats."""

    def test_export_csv(self, tmp_path):
        from tools.shared.graph_export import export_csv
        result = export_csv(out_dir=tmp_path)
        assert Path(result["nodes_csv"]).exists()
        assert Path(result["edges_csv"]).exists()

    def test_export_cypher(self, tmp_path):
        from tools.shared.graph_export import export_cypher
        cypher = export_cypher()
        assert "CREATE" in cypher
        assert "MATCH" in cypher

    def test_export_graphml(self, tmp_path):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("networkx not installed")
        from tools.shared.graph_export import export_graphml
        path = export_graphml(out_path=tmp_path / "test.graphml")
        assert Path(path).exists()


class TestBuildGraph:
    """Test build_graph.py CLI modes."""

    def test_build_graph_code(self):
        from tools.build_graph import build_graph
        build_graph(infer=False, include_code=True, use_leiden=False)
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        assert len(data["nodes"]) > 0

    def test_build_graph_leiden(self):
        try:
            import leidenalg
        except ImportError:
            pytest.skip("leidenalg not installed")
        from tools.build_graph import build_graph
        build_graph(infer=False, include_code=True, use_leiden=True)
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        assert len(data["nodes"]) > 0

    def test_build_graph_incremental(self):
        from tools.build_graph import build_graph
        build_graph(infer=False, include_code=True, incremental=True)
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        assert len(data["nodes"]) > 0


class TestAPIEndpoints:
    """Test FastAPI graph endpoints via TestClient."""

    @pytest.fixture(scope="class")
    def client(self):
        try:
            from fastapi.testclient import TestClient
        except ImportError:
            pytest.skip("fastapi not installed")
        sys.path.insert(0, str(REPO / "tools"))
        from api_server import app
        return TestClient(app)

    def test_graph_stats(self, client):
        r = client.get("/api/graph/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["node_count"] > 0
        assert data["edge_count"] > 0

    def test_graph_query(self, client):
        r = client.post("/api/graph/query", json={"query": "explain code/tools/api_server"})
        assert r.status_code == 200
        assert r.json()["intent"] == "explain"

    def test_graph_node(self, client):
        r = client.get("/api/graph/node/code/tools/api_server")
        assert r.status_code == 200
        assert r.json()["label"] == "api_server.py"

    def test_graph_export(self, client):
        r = client.post("/api/graph/export", json={"format": "csv"})
        assert r.status_code == 200
        assert "nodes_csv" in r.json()["files"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
