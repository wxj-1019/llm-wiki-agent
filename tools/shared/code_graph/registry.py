#!/usr/bin/env python3
"""Central parser registry — auto-discovers and holds all CodeParser instances."""
from __future__ import annotations

from .base import CodeParser

_REGISTRY: dict[str, CodeParser] = {}  # ext (without dot) -> parser instance


def register_parser(parser: CodeParser) -> None:
    """Register a parser for all its supported extensions."""
    for ext in parser.supported_extensions:
        key = ext.lower().lstrip(".")
        _REGISTRY[key] = parser


def get_parser(path: str) -> CodeParser | None:
    """Return the parser responsible for *path*, or None."""
    if "." not in path:
        return None
    ext = path.rsplit(".", 1)[-1].lower()
    return _REGISTRY.get(ext)


def list_parsers() -> list[str]:
    """Return all registered extensions."""
    return list(_REGISTRY.keys())


def clear_parsers() -> None:
    _REGISTRY.clear()
