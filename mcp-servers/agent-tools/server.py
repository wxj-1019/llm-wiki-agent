#!/usr/bin/env python3
"""Agent Tools MCP Server — 执行 wiki 管理操作."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent

mcp = FastMCP("agent-tools")


@mcp.tool()
def ingest_document(path: str) -> str:
    """摄入文档到 wiki 知识库."""
    result = subprocess.run(
        [sys.executable, str(REPO / "tools" / "ingest.py"), str(REPO / path)],
        capture_output=True, text=True, cwd=str(REPO), timeout=300,
    )
    return result.stdout[-2000:] if result.returncode == 0 else f"Error: {result.stderr[-500:]}"


@mcp.tool()
def build_graph() -> str:
    """构建/重建知识图谱."""
    result = subprocess.run(
        [sys.executable, str(REPO / "tools" / "build_graph.py")],
        capture_output=True, text=True, cwd=str(REPO), timeout=600,
    )
    return result.stdout[-2000:] if result.returncode == 0 else f"Error: {result.stderr[-500:]}"


@mcp.tool()
def run_health_check() -> str:
    """运行 wiki 健康检查."""
    result = subprocess.run(
        [sys.executable, str(REPO / "tools" / "health.py"), "--json"],
        capture_output=True, text=True, cwd=str(REPO), timeout=30,
    )
    return result.stdout[-2000:] if result.returncode == 0 else f"Error: {result.stderr[-500:]}"


if __name__ == "__main__":
    mcp.run()
