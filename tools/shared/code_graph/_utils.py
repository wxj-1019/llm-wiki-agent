#!/usr/bin/env python3
"""Shared utilities for code graph parsers."""
from __future__ import annotations

from pathlib import Path


def module_id(path: Path, repo_root: Path) -> str:
    """Canonical node id for a source file."""
    rel = path.relative_to(repo_root).as_posix()
    # Remove longest extension first to avoid .tsx -> .x
    for ext in ('.tsx', '.ts', '.jsx', '.js', '.py'):
        if rel.endswith(ext):
            rel = rel[:-len(ext)]
            break
    return f"code/{rel}"


def resolve_import_to_file(import_path: str, source_file: Path, repo_root: Path) -> Path | None:
    """Try to map an import string to a file on disk.

    Examples:
        "tools.api_server"      -> tools/api_server.py
        "tools.jarvis.config"   -> tools/jarvis/config.py
        "./utils"               -> <source_dir>/utils.ts
        "@/components/Button"   -> wiki-viewer/src/components/Button.tsx
    """
    # Handle relative imports
    if import_path.startswith("./") or import_path.startswith("../"):
        candidate = source_file.parent / import_path
        for suffix in (".ts", ".tsx", ".js", ".jsx", ".py", "/index.ts", "/index.tsx", "/index.js"):
            cand = candidate.parent / (candidate.name + suffix) if suffix.startswith(".") else candidate / suffix.lstrip("/")
            if cand.exists():
                return cand
        return None

    # Handle @/ alias (common in Vite/Webpack projects)
    if import_path.startswith("@/"):
        candidate = repo_root / "wiki-viewer" / "src" / import_path[2:]
        for suffix in (".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"):
            cand = candidate.parent / (candidate.name + suffix) if suffix.startswith(".") else candidate / suffix.lstrip("/")
            if cand.exists():
                return cand
        return None

    # Handle absolute Python imports
    parts = import_path.split(".")
    candidate = repo_root / Path(*parts)
    for suffix in (".py", "/__init__.py"):
        cand = candidate.parent / (candidate.name + suffix) if suffix.startswith(".") else candidate / suffix.lstrip("/")
        if cand.exists():
            return cand

    # Fallback: sibling file
    sibling = source_file.parent / (parts[-1] + source_file.suffix)
    if sibling.exists():
        return sibling

    return None
