#!/usr/bin/env python3
"""Base protocol / dataclasses for code graph extraction."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol


@dataclass
class CodeNode:
    """A node in the code-level knowledge graph."""
    id: str
    label: str
    type: str  # code_module | code_class | code_func | code_interface
    path: str
    language: str
    parent: str | None = None  # e.g. module id for class/func nodes
    line_start: int = 0
    line_end: int = 0
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "path": self.path,
            "language": self.language,
        }
        if self.parent:
            d["parent"] = self.parent
        if self.extra:
            d.update(self.extra)
        return d


@dataclass
class CodeEdge:
    """An edge in the code-level knowledge graph."""
    source: str
    target: str
    edge_type: str  # IMPORTS | INHERITS | IMPLEMENTS | CALLS | CONTAINS
    confidence: float = 1.0
    line: int = 0

    def to_dict(self) -> dict:
        return {
            "id": f"{self.source}->{self.target}:{self.edge_type}",
            "from": self.source,
            "to": self.target,
            "type": self.edge_type,
            "color": _EDGE_COLORS.get(self.edge_type, "#9E9E9E"),
            "confidence": self.confidence,
        }


_EDGE_COLORS = {
    "IMPORTS": "#4CAF50",
    "INHERITS": "#2196F3",
    "IMPLEMENTS": "#9C27B0",
    "CALLS": "#FF5722",
    "CONTAINS": "#9E9E9E",
    "DEPENDS_ON": "#795548",
}


class CodeParser(Protocol):
    """Unified interface that every language parser must implement."""

    @property
    def supported_extensions(self) -> set[str]:
        """Return the file extensions this parser handles, e.g. {'.py'}."""
        ...

    def parse(self, path: Path, repo_root: Path) -> tuple[list[CodeNode], list[CodeEdge]]:
        """Parse *path* and return (nodes, edges)."""
        ...
