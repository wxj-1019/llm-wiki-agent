#!/usr/bin/env python3
"""Code-level knowledge graph extraction for the project source tree.

Inspired by graphify's tree-sitter AST extraction pass.  Since the project is
primarily Python + TypeScript, we use Python's built-in ``ast`` module for
``.py`` files and lightweight regex heuristics for ``.ts/.tsx`` imports.

Nodes:
  - ``code_module``  — a source file (e.g. tools/api_server.py)
  - ``code_func``    — a top-level function or method (optional)
  - ``code_class``   — a class definition (optional)

Edges:
  - ``IMPORTS`` (EXTRACTED) — explicit import / from ... import
  - ``CALLS``   (INFERRED)  — intra-project function call (best-effort)

Usage:
    from tools.shared.code_graph import build_code_graph
    nodes, edges = build_code_graph()
"""
from __future__ import annotations

import ast
import json
import re
from pathlib import Path
from typing import Iterator

REPO_ROOT = Path(__file__).parent.parent.parent
CODE_DIRS = [REPO_ROOT / "tools", REPO_ROOT / "wiki-viewer" / "src"]
EXCLUDE_PATTERNS = {"__pycache__", "node_modules", ".venv", "dist", "build"}


def _iter_source_files() -> Iterator[Path]:
    """Yield .py / .ts / .tsx files under the tracked code directories."""
    for base in CODE_DIRS:
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if not p.is_file():
                continue
            if any(part in EXCLUDE_PATTERNS for part in p.parts):
                continue
            if p.suffix in (".py", ".ts", ".tsx"):
                yield p


def _module_id(path: Path) -> str:
    """Canonical node id for a source file, e.g. ``code/tools/api_server``."""
    rel = path.relative_to(REPO_ROOT).as_posix()
    # Strip extension so that tools/api_server.py and tools/api_server.ts map cleanly
    return f"code/{rel.replace('.py', '').replace('.ts', '').replace('.tsx', '')}"


def _resolve_import_to_file(import_path: str, source_file: Path) -> Path | None:
    """Try to map an import string (e.g. ``tools.api_server``) to a file on disk."""
    # Absolute import: tools.api_server -> tools/api_server.py
    parts = import_path.split(".")
    candidate = REPO_ROOT / Path(*parts)
    for suffix in (".py", ".ts", "/index.ts", "/index.tsx", ".tsx"):
        if (candidate.parent / (candidate.name + suffix)).exists():
            return candidate.parent / (candidate.name + suffix)
        if (candidate / suffix.lstrip("/")).exists():
            return candidate / suffix.lstrip("/")
    # Relative import heuristic: look in same directory
    if source_file.suffix == ".py":
        sibling = source_file.parent / (parts[-1] + ".py")
        if sibling.exists():
            return sibling
        sibling_init = source_file.parent / parts[-1] / "__init__.py"
        if sibling_init.exists():
            return sibling_init
    return None


def _parse_python_imports(path: Path) -> tuple[list[dict], list[dict]]:
    """Parse a Python file with ``ast``.  Returns (nodes, edges)."""
    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
    except (SyntaxError, UnicodeDecodeError):
        return [], []

    mod_id = _module_id(path)
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_targets: set[str] = set()

    # Module node
    nodes.append({
        "id": mod_id,
        "label": path.name,
        "type": "code_module",
        "path": path.relative_to(REPO_ROOT).as_posix(),
        "language": "python",
    })

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                target_file = _resolve_import_to_file(alias.name, path)
                if target_file:
                    tid = _module_id(target_file)
                    if tid != mod_id and tid not in seen_targets:
                        seen_targets.add(tid)
                        edges.append({
                            "id": f"{mod_id}->{tid}:IMPORTS",
                            "from": mod_id,
                            "to": tid,
                            "type": "IMPORTS",
                            "color": "#4CAF50",
                            "confidence": 1.0,
                        })
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            # Only track intra-project imports
            if module.startswith("tools.") or module.startswith("wiki_viewer.") or module == "tools":
                target_file = _resolve_import_to_file(module, path)
                if target_file:
                    tid = _module_id(target_file)
                    if tid != mod_id and tid not in seen_targets:
                        seen_targets.add(tid)
                        edges.append({
                            "id": f"{mod_id}->{tid}:IMPORTS",
                            "from": mod_id,
                            "to": tid,
                            "type": "IMPORTS",
                            "color": "#4CAF50",
                            "confidence": 1.0,
                        })

        # Optional: collect top-level classes / functions as extra nodes
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            func_id = f"{mod_id}#{node.name}"
            nodes.append({
                "id": func_id,
                "label": node.name,
                "type": "code_func",
                "parent": mod_id,
                "language": "python",
            })
            edges.append({
                "id": f"{mod_id}->{func_id}:CONTAINS",
                "from": mod_id,
                "to": func_id,
                "type": "CONTAINS",
                "color": "#9E9E9E",
                "confidence": 1.0,
            })
        elif isinstance(node, ast.ClassDef):
            cls_id = f"{mod_id}#{node.name}"
            nodes.append({
                "id": cls_id,
                "label": node.name,
                "type": "code_class",
                "parent": mod_id,
                "language": "python",
            })
            edges.append({
                "id": f"{mod_id}->{cls_id}:CONTAINS",
                "from": mod_id,
                "to": cls_id,
                "type": "CONTAINS",
                "color": "#9E9E9E",
                "confidence": 1.0,
            })

    return nodes, edges


def _parse_ts_imports(path: Path) -> tuple[list[dict], list[dict]]:
    """Lightweight regex-based import extraction for TypeScript files."""
    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return [], []

    mod_id = _module_id(path)
    nodes = [{
        "id": mod_id,
        "label": path.name,
        "type": "code_module",
        "path": path.relative_to(REPO_ROOT).as_posix(),
        "language": "typescript",
    }]
    edges: list[dict] = []
    seen: set[str] = set()

    # Match: import ... from "./path" or import ... from "@/path"
    for m in re.finditer(r'import\s+.*?\s+from\s+["\']([^"\']+)["\'];?', source):
        spec = m.group(1)
        if spec.startswith(".") or spec.startswith("@/"):
            # Resolve relative to source file
            if spec.startswith("@/"):
                rel = spec[2:]
                candidate = REPO_ROOT / "wiki-viewer" / "src" / rel
            else:
                candidate = path.parent / spec
            for suffix in (".ts", ".tsx", "/index.ts", "/index.tsx", ".js"):
                cand = candidate.parent / (candidate.name + suffix) if suffix.startswith(".") else candidate / suffix.lstrip("/")
                if cand.exists():
                    tid = _module_id(cand)
                    if tid != mod_id and tid not in seen:
                        seen.add(tid)
                        edges.append({
                            "id": f"{mod_id}->{tid}:IMPORTS",
                            "from": mod_id,
                            "to": tid,
                            "type": "IMPORTS",
                            "color": "#4CAF50",
                            "confidence": 1.0,
                        })
                    break
    return nodes, edges


def build_code_graph() -> tuple[list[dict], list[dict]]:
    """Build nodes and edges for the project source tree.

    Returns two lists: (nodes, edges) ready to merge into the wiki graph.
    """
    all_nodes: list[dict] = []
    all_edges: list[dict] = []

    for path in _iter_source_files():
        if path.suffix == ".py":
            n, e = _parse_python_imports(path)
        else:
            n, e = _parse_ts_imports(path)
        all_nodes.extend(n)
        all_edges.extend(e)

    return all_nodes, all_edges


if __name__ == "__main__":
    nodes, edges = build_code_graph()
    print(f"Code graph: {len(nodes)} nodes, {len(edges)} edges")
    # Quick summary
    mods = [n for n in nodes if n["type"] == "code_module"]
    funcs = [n for n in nodes if n["type"] == "code_func"]
    classes = [n for n in nodes if n["type"] == "code_class"]
    print(f"  modules: {len(mods)}, functions: {len(funcs)}, classes: {len(classes)}")
    import_edges = [e for e in edges if e["type"] == "IMPORTS"]
    print(f"  import edges: {len(import_edges)}")
    out = {"nodes": nodes, "edges": edges}
    out_path = REPO_ROOT / "graph" / "code-graph.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  saved: {out_path}")
