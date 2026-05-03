#!/usr/bin/env python3
"""Filesystem MCP Server — 管理 raw/ 目录下的源文件."""
from __future__ import annotations

from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent
RAW = REPO / "raw"

mcp = FastMCP("filesystem")


@mcp.tool()
def list_raw_files() -> str:
    """列出 raw/ 目录下所有源文件."""
    files = [str(p.relative_to(REPO)) for p in RAW.rglob("*") if p.is_file()]
    return "\n".join(files)


@mcp.tool()
def read_raw_file(path: str) -> str:
    """读取 raw/ 目录下的源文件内容."""
    target = (REPO / path).resolve()
    if not target.is_relative_to(RAW.resolve()):
        return "Error: path traversal denied"
    if not target.exists():
        return f"Error: file not found: {path}"
    return target.read_text(encoding="utf-8", errors="replace")


if __name__ == "__main__":
    mcp.run()
