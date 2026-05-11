#!/usr/bin/env python3
"""High-level builder: scan directories → parse files → return unified code graph."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from .base import CodeNode, CodeEdge
from .registry import get_parser


DEFAULT_SCAN_DIRS = ["tools", "wiki-viewer/src", "src"]
DEFAULT_EXCLUDE = {"__pycache__", "node_modules", ".venv", "vendor", "dist", "build", ".git"}


MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def scan_files(
    repo_root: Path,
    dirs: Iterable[str] | None = None,
    exclude: set[str] | None = None,
    max_size: int = MAX_FILE_SIZE,
) -> list[Path]:
    """Return all source files under *dirs* that have a registered parser."""
    dirs = dirs or DEFAULT_SCAN_DIRS
    exclude = exclude or DEFAULT_EXCLUDE
    files: list[Path] = []
    for d in dirs:
        base = repo_root / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if not p.is_file():
                continue
            if any(part in exclude for part in p.parts):
                continue
            try:
                if p.stat().st_size > max_size:
                    continue
            except OSError:
                continue
            if get_parser(str(p)):
                files.append(p)
    return files


def build_code_graph(
    repo_root: Path,
    dirs: Iterable[str] | None = None,
    exclude: set[str] | None = None,
) -> tuple[list[dict], list[dict]]:
    """Scan, parse, and return (nodes, edges) as plain dicts."""
    files = scan_files(repo_root, dirs, exclude)
    all_nodes: list[CodeNode] = []
    all_edges: list[CodeEdge] = []

    for path in files:
        parser = get_parser(str(path))
        if not parser:
            continue
        try:
            nodes, edges = parser.parse(path, repo_root)
            all_nodes.extend(nodes)
            all_edges.extend(edges)
        except Exception as exc:
            print(f"[code_graph] skip {path}: {exc}")

    # Deduplicate nodes by id
    node_map: dict[str, CodeNode] = {}
    for n in all_nodes:
        node_map[n.id] = n

    # Deduplicate edges by (source, target, type)
    edge_map: dict[str, CodeEdge] = {}
    for e in all_edges:
        key = f"{e.source}->{e.target}:{e.edge_type}"
        edge_map[key] = e

    return [n.to_dict() for n in node_map.values()], [e.to_dict() for e in edge_map.values()]


def _file_hash(path: Path) -> str:
    import hashlib
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    except OSError:
        return ""


def build_code_graph_incremental(
    repo_root: Path,
    existing_nodes: list[dict],
    existing_edges: list[dict],
    code_hashes: dict[str, str],
    dirs: Iterable[str] | None = None,
    exclude: set[str] | None = None,
) -> tuple[list[dict], list[dict], dict[str, str]]:
    """Incremental code graph build.

    Returns (merged_nodes, merged_edges, updated_code_hashes).
    """
    from ._utils import module_id
    files = scan_files(repo_root, dirs, exclude)
    current_hashes = {str(f.resolve()): _file_hash(f) for f in files}

    changed_files: set[Path] = set()
    for f in files:
        key = str(f.resolve())
        if code_hashes.get(key) != current_hashes.get(key):
            changed_files.add(f)

    # Detect deleted files
    deleted_keys = set(code_hashes.keys()) - set(current_hashes.keys())
    deleted_ids: set[str] = set()
    for key in deleted_keys:
        p = Path(key)
        try:
            deleted_ids.add(module_id(p, repo_root))
        except Exception:
            pass

    # Keep existing code nodes/edges for unchanged files
    # A node is "unchanged" if its module_id prefix does NOT match any changed/deleted file
    changed_ids: set[str] = set()
    for f in changed_files:
        changed_ids.add(module_id(f, repo_root))

    # Build prefix map: id -> True if this id or its parent is changed/deleted
    def _is_stale(nid: str) -> bool:
        if nid in deleted_ids:
            return True
        for cid in changed_ids:
            if nid == cid or nid.startswith(cid + "#"):
                return True
        return False

    kept_nodes = [n for n in existing_nodes if n.get("type", "").startswith("code_") and not _is_stale(n.get("id", ""))]
    kept_edges = [e for e in existing_edges
                  if e.get("type", "") in {"IMPORTS", "INHERITS", "IMPLEMENTS", "CALLS", "CONTAINS", "DEPENDS_ON"}
                  and not (_is_stale(e.get("from", e.get("source", ""))) or _is_stale(e.get("to", e.get("target", ""))))]

    # Parse changed files
    new_nodes: list[CodeNode] = []
    new_edges: list[CodeEdge] = []
    for path in changed_files:
        parser = get_parser(str(path))
        if not parser:
            continue
        try:
            nodes, edges = parser.parse(path, repo_root)
            new_nodes.extend(nodes)
            new_edges.extend(edges)
        except Exception as exc:
            print(f"[code_graph] skip {path}: {exc}")

    # Deduplicate new nodes
    node_map: dict[str, CodeNode] = {}
    for n in kept_nodes:
        if isinstance(n, dict):
            node_map[n["id"]] = None  # marker
    for n in new_nodes:
        node_map[n.id] = n

    # Deduplicate new edges
    edge_map: dict[str, CodeEdge] = {}
    for e in kept_edges:
        if isinstance(e, dict):
            key = f"{e.get('from', e.get('source'))}->{e.get('to', e.get('target'))}:{e.get('type', e.get('edge_type'))}"
            edge_map[key] = None
    for e in new_edges:
        key = f"{e.source}->{e.target}:{e.edge_type}"
        edge_map[key] = e

    result_nodes = [n for n in kept_nodes if isinstance(n, dict)]
    result_nodes.extend([n.to_dict() for n in node_map.values() if isinstance(n, CodeNode)])
    result_edges = [e for e in kept_edges if isinstance(e, dict)]
    result_edges.extend([e.to_dict() for e in edge_map.values() if isinstance(e, CodeEdge)])

    return result_nodes, result_edges, current_hashes


def save_code_graph(
    repo_root: Path,
    out_path: Path,
    dirs: Iterable[str] | None = None,
    exclude: set[str] | None = None,
) -> None:
    """Build and write graph.json compatible output."""
    nodes, edges = build_code_graph(repo_root, dirs, exclude)
    payload = {
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "builder": "graphify_phase1",
        },
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[code_graph] wrote {len(nodes)} nodes, {len(edges)} edges → {out_path}")
