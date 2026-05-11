#!/usr/bin/env python3
"""Graphify Phase 1 — tree-sitter based code graph extraction."""
from __future__ import annotations

from .base import CodeNode, CodeEdge, CodeParser
from .registry import register_parser, get_parser, list_parsers, clear_parsers

# Auto-register built-in parsers (best-effort; missing tree-sitter bindings are silently skipped)

def _auto_register() -> None:
    try:
        from .python_parser import PythonParser
        register_parser(PythonParser())
    except Exception:
        pass

    try:
        from .typescript_parser import TypeScriptParser, JavaScriptParser
        register_parser(TypeScriptParser())
        register_parser(JavaScriptParser())
    except Exception:
        pass


_auto_register()

__all__ = [
    "CodeNode",
    "CodeEdge",
    "CodeParser",
    "register_parser",
    "get_parser",
    "list_parsers",
    "clear_parsers",
]
