#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from tools.jarvis.tool_registry import register_tool
from tools.jarvis.types import RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent.parent


def _run_subprocess(cmd: list[str], timeout: int = 300) -> dict:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=str(REPO_ROOT),
    )
    return {
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "success": result.returncode == 0,
    }


def _register_wiki_read():
    @register_tool(
        name="wiki_read",
        description="Read a wiki page from the wiki/ directory",
        risk_level=RiskLevel.L0,
        input_schema={"path": {"type": "str", "required": True}},
        output_schema={"content": {"type": "str"}},
        category="knowledge",
    )
    def wiki_read(path: str) -> dict:
        target = REPO_ROOT / "wiki" / path
        if not target.exists():
            return {"content": "", "error": f"Page not found: {path}"}
        return {"content": target.read_text(encoding="utf-8")}


def _register_wiki_write():
    @register_tool(
        name="wiki_write",
        description="Write content to a wiki page in the wiki/ directory",
        risk_level=RiskLevel.L1,
        input_schema={
            "path": {"type": "str", "required": True},
            "content": {"type": "str", "required": True},
        },
        output_schema={"success": {"type": "bool"}},
        category="knowledge",
    )
    def wiki_write(path: str, content: str) -> dict:
        target = REPO_ROOT / "wiki" / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"success": True}


def _register_wiki_list():
    @register_tool(
        name="wiki_list",
        description="List wiki pages, optionally filtered by page type",
        risk_level=RiskLevel.L0,
        input_schema={"page_type": {"type": "str", "required": False}},
        output_schema={"pages": {"type": "list[str]"}},
        category="knowledge",
    )
    def wiki_list(page_type: str = "") -> dict:
        wiki_dir = REPO_ROOT / "wiki"
        if page_type:
            search_dir = wiki_dir / page_type
            if not search_dir.exists():
                return {"pages": []}
            base = search_dir
        else:
            base = wiki_dir
        pages = sorted(
            str(p.relative_to(wiki_dir))
            for p in base.rglob("*.md")
            if p.name != ".gitkeep"
        )
        return {"pages": pages}


def _register_wiki_search():
    try:
        from tools.search_engine import WikiSearchEngine
    except ImportError:
        print("WARNING: tools.search_engine unavailable, skipping wiki_search tool")
        return

    _engine = None

    def _get_engine():
        nonlocal _engine
        if _engine is None:
            _engine = WikiSearchEngine()
        return _engine

    @register_tool(
        name="wiki_search",
        description="Full-text search across all wiki pages using FTS5",
        risk_level=RiskLevel.L0,
        input_schema={
            "query": {"type": "str", "required": True},
            "limit": {"type": "int", "required": False},
        },
        output_schema={"results": {"type": "list"}},
        category="knowledge",
    )
    def wiki_search(query: str, limit: int = 10) -> dict:
        engine = _get_engine()
        result = engine.search(query, limit=limit)
        return {"results": result.get("results", [])}


def _register_health_check():
    @register_tool(
        name="health_check",
        description="Run structural health checks on the wiki (zero LLM calls)",
        risk_level=RiskLevel.L0,
        input_schema={},
        output_schema={"health": {"type": "dict"}},
        category="knowledge",
    )
    def health_check() -> dict:
        result = _run_subprocess(
            [sys.executable, str(REPO_ROOT / "tools" / "health.py"), "--json"]
        )
        if not result["success"]:
            return {
                "health": {},
                "error": result.get("stderr", "health check failed"),
            }
        try:
            data = json.loads(result["stdout"])
        except json.JSONDecodeError:
            return {"health": {}, "raw": result["stdout"]}
        return {"health": data}


def _register_quality_score():
    try:
        from tools.shared.quality import score_page, score_all_pages, get_quality_summary
    except ImportError:
        print("WARNING: tools.shared.quality unavailable, skipping quality_score tool")
        return

    @register_tool(
        name="quality_score",
        description="Score wiki page quality or get an overall quality summary",
        risk_level=RiskLevel.L0,
        input_schema={"path": {"type": "str", "required": False}},
        output_schema={"score": {"type": "dict"}},
        category="knowledge",
    )
    def quality_score(path: str = "") -> dict:
        if path:
            return {"score": score_page(REPO_ROOT / "wiki" / path)}
        return {"score": get_quality_summary()}


def _register_ingest():
    @register_tool(
        name="ingest",
        description="Ingest a source document into the wiki",
        risk_level=RiskLevel.L1,
        input_schema={"file_path": {"type": "str", "required": True}},
        output_schema={
            "success": {"type": "bool"},
            "output": {"type": "str"},
        },
        category="knowledge",
    )
    def ingest(file_path: str) -> dict:
        result = _run_subprocess(
            [sys.executable, str(REPO_ROOT / "tools" / "ingest.py"), file_path],
            timeout=600,
        )
        return {
            "success": result["success"],
            "output": result["stdout"],
        }


def _register_lint():
    @register_tool(
        name="lint",
        description="Run content quality lint checks on the wiki",
        risk_level=RiskLevel.L1,
        input_schema={},
        output_schema={"report": {"type": "dict"}},
        category="knowledge",
    )
    def lint() -> dict:
        result = _run_subprocess(
            [sys.executable, str(REPO_ROOT / "tools" / "lint.py"), "--json"]
        )
        if not result["success"]:
            return {
                "report": {},
                "error": result.get("stderr", "lint failed"),
            }
        try:
            data = json.loads(result["stdout"])
        except json.JSONDecodeError:
            return {"report": {}, "raw": result["stdout"]}
        return {"report": data}


def _register_heal():
    @register_tool(
        name="heal",
        description="Auto-heal missing entity pages in the wiki",
        risk_level=RiskLevel.L1,
        input_schema={},
        output_schema={"output": {"type": "str"}},
        category="knowledge",
    )
    def heal() -> dict:
        result = _run_subprocess(
            [sys.executable, str(REPO_ROOT / "tools" / "heal.py")]
        )
        return {"output": result["stdout"]}


def _register_refresh():
    @register_tool(
        name="refresh",
        description="Refresh stale source pages in the wiki",
        risk_level=RiskLevel.L1,
        input_schema={},
        output_schema={"output": {"type": "str"}},
        category="knowledge",
    )
    def refresh() -> dict:
        result = _run_subprocess(
            [sys.executable, str(REPO_ROOT / "tools" / "refresh.py")]
        )
        return {"output": result["stdout"]}


def _register_build_graph():
    @register_tool(
        name="build_graph",
        description="Build or rebuild the knowledge graph from wiki pages",
        risk_level=RiskLevel.L1,
        input_schema={"no_infer": {"type": "bool", "required": False}},
        output_schema={"output": {"type": "str"}},
        category="knowledge",
    )
    def build_graph(no_infer: bool = False) -> dict:
        cmd = [sys.executable, str(REPO_ROOT / "tools" / "build_graph.py")]
        if no_infer:
            cmd.append("--no-infer")
        result = _run_subprocess(cmd, timeout=600)
        return {"output": result["stdout"]}


def _register_self_optimize():
    @register_tool(
        name="self_optimize",
        description="Run a self-optimization cycle on the wiki",
        risk_level=RiskLevel.L1,
        input_schema={"scope": {"type": "str", "required": False}},
        output_schema={"output": {"type": "str"}},
        category="knowledge",
    )
    def self_optimize(scope: str = "") -> dict:
        cmd = [
            sys.executable,
            str(REPO_ROOT / "tools" / "self_optimize.py"),
            "--auto-fix",
        ]
        if scope:
            cmd.extend(["--scope", scope])
        result = _run_subprocess(cmd, timeout=600)
        return {"output": result["stdout"]}


_ALL_REGISTRARS = [
    _register_wiki_read,
    _register_wiki_write,
    _register_wiki_list,
    _register_wiki_search,
    _register_health_check,
    _register_quality_score,
    _register_ingest,
    _register_lint,
    _register_heal,
    _register_refresh,
    _register_build_graph,
    _register_self_optimize,
]


def register_all():
    for registrar in _ALL_REGISTRARS:
        try:
            registrar()
        except Exception as exc:
            print(f"WARNING: failed to register tool from {registrar.__name__}: {exc}")
