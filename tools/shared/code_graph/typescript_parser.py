#!/usr/bin/env python3
"""TypeScript / JavaScript code parser using tree-sitter."""
from __future__ import annotations

from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_typescript as tsts
import tree_sitter_javascript as tsjs

from .base import CodeNode, CodeEdge, CodeParser
from ._utils import module_id, resolve_import_to_file

TS_LANGUAGE = Language(tsts.language_typescript())
JS_LANGUAGE = Language(tsjs.language())


class TypeScriptParser(CodeParser):
    @property
    def supported_extensions(self) -> set[str]:
        return {".ts", ".tsx"}

    def parse(self, path: Path, repo_root: Path) -> tuple[list[CodeNode], list[CodeEdge]]:
        source = path.read_text(encoding="utf-8")
        parser = Parser(TS_LANGUAGE)
        tree = parser.parse(source.encode())
        root = tree.root_node
        mod_id = module_id(path, repo_root)
        nodes: list[CodeNode] = []
        edges: list[CodeEdge] = []

        nodes.append(CodeNode(
            id=mod_id,
            label=path.name,
            type="code_module",
            path=path.relative_to(repo_root).as_posix(),
            language="typescript",
        ))

        self._walk_children(root, mod_id, path, repo_root, nodes, edges)
        return nodes, edges

    def _walk_children(self, node, mod_id: str, path: Path, repo_root: Path,
                       nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
        for child in node.children:
            ntype = child.type
            if ntype in ("import_statement", "import"):
                self._handle_import(child, mod_id, path, repo_root, edges)
            elif ntype == "class_declaration":
                self._handle_class(child, mod_id, path, repo_root, nodes, edges)
            elif ntype == "function_declaration":
                self._handle_function(child, mod_id, path, repo_root, nodes, edges)
            elif ntype == "export_statement":
                decl = child.child_by_field_name("declaration")
                if decl:
                    if decl.type == "class_declaration":
                        self._handle_class(decl, mod_id, path, repo_root, nodes, edges)
                    elif decl.type == "function_declaration":
                        self._handle_function(decl, mod_id, path, repo_root, nodes, edges)
                # Still recurse into export body for nested items
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)
            elif ntype in ("statement_block", "class_body", "program"):
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)
            elif ntype in ("variable_declaration", "lexical_declaration"):
                self._handle_variable(child, mod_id, path, repo_root, nodes, edges)
            elif ntype == "arrow_function":
                # Arrow functions are usually inside variable declarations; skip standalone
                pass
            else:
                # Recurse into unknown blocks
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)

    def _handle_import(self, node, mod_id: str, path: Path, repo_root: Path, edges: list[CodeEdge]) -> None:
        # Find string source
        for child in node.children:
            if child.type == "string":
                raw = child.text.decode() if child.text else '""'
                source_path = raw.strip('"').strip("'")
                target = resolve_import_to_file(source_path, path, repo_root)
                if target:
                    tid = module_id(target, repo_root)
                    if tid != mod_id:
                        edges.append(CodeEdge(mod_id, tid, "IMPORTS", line=child.start_point[0] + 1))
                break

    def _handle_class(self, node, mod_id: str, path: Path, repo_root: Path,
                      nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
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
            language="typescript",
            parent=mod_id,
            line_start=node.start_point[0] + 1,
            line_end=node.end_point[0] + 1,
        ))
        edges.append(CodeEdge(mod_id, cls_id, "CONTAINS"))

        # Inheritance (class_heritage)
        for child in node.children:
            if child.type == "class_heritage":
                for base in child.children:
                    if base.type in ("extends_clause", "expression"):
                        # The actual type is often nested
                        for deep in base.children:
                            if deep.type in ("identifier", "member_expression"):
                                base_name = deep.text.decode() if deep.text else ""
                                target = resolve_import_to_file(base_name, path, repo_root)
                                if target:
                                    tid = module_id(target, repo_root)
                                    edges.append(CodeEdge(cls_id, tid, "INHERITS", confidence=0.8, line=deep.start_point[0] + 1))

        # Recurse into body
        body = node.child_by_field_name("body")
        if body:
            self._walk_children(body, mod_id, path, repo_root, nodes, edges)

    def _handle_function(self, node, mod_id: str, path: Path, repo_root: Path,
                         nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
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
            language="typescript",
            parent=mod_id,
            line_start=node.start_point[0] + 1,
            line_end=node.end_point[0] + 1,
        ))
        edges.append(CodeEdge(mod_id, func_id, "CONTAINS"))

        body = node.child_by_field_name("body")
        if body:
            self._walk_children(body, mod_id, path, repo_root, nodes, edges)

    def _handle_variable(self, node, mod_id: str, path: Path, repo_root: Path,
                         nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
        # Look for const X = (...) => { ... } patterns
        for child in node.children:
            if child.type == "variable_declarator":
                name_node = child.child_by_field_name("name")
                value_node = child.child_by_field_name("value")
                if name_node and value_node and value_node.type == "arrow_function":
                    func_name = name_node.text.decode() if name_node.text else ""
                    func_id = f"{mod_id}#{func_name}"
                    nodes.append(CodeNode(
                        id=func_id,
                        label=func_name,
                        type="code_func",
                        path=path.relative_to(repo_root).as_posix(),
                        language="typescript",
                        parent=mod_id,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                    ))
                    edges.append(CodeEdge(mod_id, func_id, "CONTAINS"))


class JavaScriptParser(CodeParser):
    @property
    def supported_extensions(self) -> set[str]:
        return {".js", ".jsx"}

    def parse(self, path: Path, repo_root: Path) -> tuple[list[CodeNode], list[CodeEdge]]:
        source = path.read_text(encoding="utf-8")
        parser = Parser(JS_LANGUAGE)
        tree = parser.parse(source.encode())
        root = tree.root_node
        mod_id = module_id(path, repo_root)
        nodes: list[CodeNode] = []
        edges: list[CodeEdge] = []

        nodes.append(CodeNode(
            id=mod_id,
            label=path.name,
            type="code_module",
            path=path.relative_to(repo_root).as_posix(),
            language="javascript",
        ))

        self._walk_children(root, mod_id, path, repo_root, nodes, edges)
        return nodes, edges

    def _walk_children(self, node, mod_id: str, path: Path, repo_root: Path,
                       nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
        for child in node.children:
            ntype = child.type
            if ntype in ("import_statement", "import"):
                self._handle_import(child, mod_id, path, repo_root, edges)
            elif ntype == "class_declaration":
                self._handle_class(child, mod_id, path, repo_root, nodes, edges)
            elif ntype == "function_declaration":
                self._handle_function(child, mod_id, path, repo_root, nodes, edges)
            elif ntype == "export_statement":
                decl = child.child_by_field_name("declaration")
                if decl:
                    if decl.type == "class_declaration":
                        self._handle_class(decl, mod_id, path, repo_root, nodes, edges)
                    elif decl.type == "function_declaration":
                        self._handle_function(decl, mod_id, path, repo_root, nodes, edges)
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)
            elif ntype in ("statement_block", "class_body", "program"):
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)
            else:
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)

    def _handle_import(self, node, mod_id: str, path: Path, repo_root: Path, edges: list[CodeEdge]) -> None:
        for child in node.children:
            if child.type == "string":
                raw = child.text.decode() if child.text else '""'
                source_path = raw.strip('"').strip("'")
                target = resolve_import_to_file(source_path, path, repo_root)
                if target:
                    tid = module_id(target, repo_root)
                    if tid != mod_id:
                        edges.append(CodeEdge(mod_id, tid, "IMPORTS", line=child.start_point[0] + 1))
                break

    def _handle_class(self, node, mod_id: str, path: Path, repo_root: Path,
                      nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        cls_name = name_node.text.decode() if name_node.text else ""
        cls_id = f"{mod_id}#{cls_name}"
        nodes.append(CodeNode(
            id=cls_id, label=cls_name, type="code_class",
            path=path.relative_to(repo_root).as_posix(), language="javascript",
            parent=mod_id, line_start=node.start_point[0] + 1, line_end=node.end_point[0] + 1,
        ))
        edges.append(CodeEdge(mod_id, cls_id, "CONTAINS"))
        for child in node.children:
            if child.type == "class_heritage":
                for base in child.children:
                    if base.type in ("extends_clause", "expression"):
                        for deep in base.children:
                            if deep.type in ("identifier", "member_expression"):
                                base_name = deep.text.decode() if deep.text else ""
                                target = resolve_import_to_file(base_name, path, repo_root)
                                if target:
                                    edges.append(CodeEdge(cls_id, module_id(target, repo_root), "INHERITS", confidence=0.8, line=deep.start_point[0] + 1))
            elif child.type == "class_body":
                self._walk_children(child, mod_id, path, repo_root, nodes, edges)

    def _handle_function(self, node, mod_id: str, path: Path, repo_root: Path,
                         nodes: list[CodeNode], edges: list[CodeEdge]) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        func_name = name_node.text.decode() if name_node.text else ""
        func_id = f"{mod_id}#{func_name}"
        nodes.append(CodeNode(
            id=func_id, label=func_name, type="code_func",
            path=path.relative_to(repo_root).as_posix(), language="javascript",
            parent=mod_id, line_start=node.start_point[0] + 1, line_end=node.end_point[0] + 1,
        ))
        edges.append(CodeEdge(mod_id, func_id, "CONTAINS"))
        body = node.child_by_field_name("body")
        if body:
            self._walk_children(body, mod_id, path, repo_root, nodes, edges)


# Register
from .registry import register_parser
register_parser(TypeScriptParser())
register_parser(JavaScriptParser())
