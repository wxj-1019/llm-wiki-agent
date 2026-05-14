---
title: "Python Code Parser (python_parser.py) — Tree-sitter Based Python AST Extractor"
type: source
tags: [code, parser, python, tree-sitter, ast]
date: 2026-05-14
source_file: python_parser.py
---

## Summary
The `python_parser.py` module implements a [[CodeParser]] for Python source files using [[TreeSitter]]. It walks the AST to extract [[CodeNode]] and [[CodeEdge]] structures for modules, imports, classes, functions, and inheritance relationships. Designed as part of an extensible code graph extraction framework, it registers itself via `register_parser()` in the [[CodeGraphRegistry]].

## Key Claims
- **Supported extensions**: Only `.py` files.
- **Node types produced**: `code_module` (for each file), `code_class`, and `code_func`.
- **Edges**: `CONTAINS` (module→class, module→function), `IMPORTS` (module→module for `import X` and `from X import Y`), and `INHERITS` (class→class for superclasses, confidence=0.8).
- **Decorated definitions**: Handles `@decorator\ndef func()` by unwrapping the decorated_definition node to find the inner function.
- **Line numbers**: All edges include the source line number (`start_point[0] + 1`).
- **Module ID**: Uses `module_id()` from `_utils` to generate canonical IDs relative to the repo root.
- **Import resolution**: Uses `resolve_import_to_file()` to map import names to actual file paths within the project, skipping self-imports.
- **Nested classes/functions**: Walks class bodies recursively to find nested function definitions.
- **Inheritance**: Extracts superclass names from the `superclasses` field node, resolves them (best-effort) within the project, and creates `INHERITS` edges.
- **Text decoding**: All node text is decoded from bytes using `node.text.decode()`.

## Key Connections
- [[CodeParser]] (concept) — the base protocol this class implements
- [[CodeNode]] (concept) — dataclass for code-level graph nodes (id, label, type, path, language, parent, line_start/end)
- [[CodeEdge]] (concept) — dataclass for edges (source, target, type, confidence, line)
- [[CodeGraphRegistry]] (concept) — the registry where the parser is registered via `register_parser(PythonParser())`
- [[TreeSitter]] (entity) — used for AST parsing; depends on `tree_sitter` and `tree_sitter_python`
- [[Code Graph Extraction Base Protocol]] (source) — defines the base classes and types
- [[CodeGraphBuilder]] (source) — uses this parser via `registry.get_parser()`

## Key Quotes
> "Extract nodes and edges from Python source files."