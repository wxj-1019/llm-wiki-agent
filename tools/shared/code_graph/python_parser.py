#!/usr/bin/env python3
"""Python code parser using tree-sitter."""
from __future__ import annotations

from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_python as tspython

from .base import CodeNode, CodeEdge, CodeParser
from ._utils import module_id, resolve_import_to_file

PY_LANGUAGE = Language(tspython.language())


class PythonParser(CodeParser):
    """Extract nodes and edges from Python source files."""

    @property
    def supported_extensions(self) -> set[str]:
        return {".py"}

    def parse(self, path: Path, repo_root: Path) -> tuple[list[CodeNode], list[CodeEdge]]:
        source = path.read_text(encoding="utf-8")
        tree = Parser(PY_LANGUAGE).parse(source.encode())
        root = tree.root_node

        mod_id = module_id(path, repo_root)
        nodes: list[CodeNode] = []
        edges: list[CodeEdge] = []

        # Module node
        nodes.append(CodeNode(
            id=mod_id,
            label=path.name,
            type="code_module",
            path=path.relative_to(repo_root).as_posix(),
            language="python",
        ))

        # Walk AST
        for node in root.children:
            self._walk(node, mod_id, path, repo_root, nodes, edges, source)

        return nodes, edges

    def _walk(self, node, mod_id: str, path: Path, repo_root: Path,
              nodes: list[CodeNode], edges: list[CodeEdge], source: str) -> None:
        ntype = node.type

        if ntype == "import_statement":
            self._handle_import(node, mod_id, path, repo_root, edges)
        elif ntype == "import_from_statement":
            self._handle_from_import(node, mod_id, path, repo_root, edges)
        elif ntype == "class_definition":
            self._handle_class(node, mod_id, path, repo_root, nodes, edges, source)
        elif ntype == "function_definition" or ntype == "decorated_definition":
            # decorated_definition wraps @decorator + def
            actual = node.child_by_field_name("definition") if ntype == "decorated_definition" else node
            if actual and actual.type == "function_definition":
                self._handle_function(actual, mod_id, path, repo_root, nodes, edges, source)

    def _handle_import(self, node, mod_id: str, path: Path, repo_root: Path, edges: list[CodeEdge]) -> None:
        for child in node.children:
            if child.type == "dotted_name":
                name = child.text.decode() if child.text else ""
                target = resolve_import_to_file(name, path, repo_root)
                if target:
                    tid = module_id(target, repo_root)
                    if tid != mod_id:
                        edges.append(CodeEdge(mod_id, tid, "IMPORTS", line=child.start_point[0] + 1))

    def _handle_from_import(self, node, mod_id: str, path: Path, repo_root: Path, edges: list[CodeEdge]) -> None:
        module_node = node.child_by_field_name("module_name")
        if not module_node:
            return
        name = module_node.text.decode() if module_node.text else ""
        target = resolve_import_to_file(name, path, repo_root)
        if target:
            tid = module_id(target, repo_root)
            if tid != mod_id:
                edges.append(CodeEdge(mod_id, tid, "IMPORTS", line=module_node.start_point[0] + 1))

    def _handle_class(self, node, mod_id: str, path: Path, repo_root: Path,
                      nodes: list[CodeNode], edges: list[CodeEdge], source: str) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        cls_name = name_node.text.decode() if name_node.text else ""
        cls_id = f"{mod_id}#{cls_name}"

        nodes.append(CodeNode(
            id=cls_id,
            label=cls_name,
            type="code_class",
            path=path.relative_to(repo_root).as_posix(),
            language="python",
            parent=mod_id,
            line_start=node.start_point[0] + 1,
            line_end=node.end_point[0] + 1,
        ))
        edges.append(CodeEdge(mod_id, cls_id, "CONTAINS"))

        # Inheritance
        bases = node.child_by_field_name("superclasses")
        if bases:
            for base in bases.children:
                if base.type in ("identifier", "attribute"):
                    base_name = base.text.decode() if base.text else ""
                    # Best-effort: assume base is in same project
                    target = resolve_import_to_file(base_name, path, repo_root)
                    if target:
                        tid = module_id(target, repo_root)
                        edges.append(CodeEdge(cls_id, tid, "INHERITS", confidence=0.8, line=base.start_point[0] + 1))

        # Walk class body for nested functions
        body = node.child_by_field_name("body")
        if body:
            for child in body.children:
                self._walk(child, mod_id, path, repo_root, nodes, edges, source)

    def _handle_function(self, node, mod_id: str, path: Path, repo_root: Path,
                         nodes: list[CodeNode], edges: list[CodeEdge], source: str) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        func_name = name_node.text.decode() if name_node.text else ""
        func_id = f"{mod_id}#{func_name}"

        nodes.append(CodeNode(
            id=func_id,
            label=func_name,
            type="code_func",
            path=path.relative_to(repo_root).as_posix(),
            language="python",
            parent=mod_id,
            line_start=node.start_point[0] + 1,
            line_end=node.end_point[0] + 1,
        ))
        edges.append(CodeEdge(mod_id, func_id, "CONTAINS"))


# Register
from .registry import register_parser
register_parser(PythonParser())
