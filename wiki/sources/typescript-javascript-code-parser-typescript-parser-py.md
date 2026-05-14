---
title: "TypeScript/JavaScript Code Parser (typescript_parser.py) — Tree-sitter Based AST Extractor"
type: source
tags: [code, parser, typescript, javascript, tree-sitter, ast]
date: 2026-05-14
source_file: typescript_parser.py
---

## Summary
The `typescript_parser.py` module implements two [[CodeParser]] subclasses — [[TypeScriptParser]] and [[JavaScriptParser]] — for parsing TypeScript (.ts, .tsx) and JavaScript (.js, .jsx) source files using [[TreeSitter]]. It walks AST trees to extract [[CodeNode]] and [[CodeEdge]] structures for modules, imports, classes, functions, and inheritance relationships. Both parsers register themselves via `register_parser()` in the [[CodeGraphRegistry]].

## Key Claims
- **Supported extensions**: `.ts`, `.tsx` for [[TypeScriptParser]]; `.js`, `.jsx` for [[JavaScriptParser]].
- **Node types produced**: `code_module` (per file), `code_class`, and `code_func`.
- **Edges**: `CONTAINS` (module→class, module→function), `IMPORTS` (module→module for imports), and `INHERITS` (class→class for superclasses, confidence=0.8).
- **Import handling**: Finds string source from `import`/`import_statement` nodes, resolves via `resolve_import_to_file()`, and skips self-imports.
- **Class handling**: Extracts class name, creates `code_class` node, and processes `class_heritage` AST subtree for [[inheritance]] detection (handles `extends_clause` and `member_expression` type identifiers).
- **Function handling**: Named `function_declaration` nodes become `code_func` nodes with `CONTAINS` edges.
- **Variable-to-arrow-function**: [[TypeScriptParser]] specifically detects `const X = (...) => { ... }` patterns via `variable_declarator` + `arrow_function` pairing and promotes them to `code_func` nodes.
- **Export handling**: Both parsers unwrap `export_statement` to find inner `class_declaration` or `function_declaration` and process them identically to their non-exported counterparts.
- **Recursive walk**: Both parsers recurse into `statement_block`, `class_body`, and `program` nodes to find nested definitions.
- **Line numbers**: All edges include source line number via `start_point[0] + 1`.
- **Module ID**: Uses `module_id()` from `_utils` to generate canonical IDs relative to repo root.
- **Registration**: Both parsers are registered at module level via `from .registry import register_parser; register_parser(...)`.

## Key Quotes
> "Supported extensions: .ts, .tsx"
> "Supported extensions: .js, .jsx"

## Connections
- [[CodeParser]] (concept) — the base protocol implemented by both [[TypeScriptParser]] and [[JavaScriptParser]]
- [[CodeNode]] (concept) — dataclass for code-level graph nodes (id, label, type, path, language, parent, line_start/end)
- [[CodeEdge]] (concept) — dataclass for edges (source, target, type, confidence, line)
- [[CodeGraphRegistry]] (concept) — registry module that maps extensions to parser instances
- [[PythonParser]] (code) — sibling parser for Python source files ([[python_parser.py]])
- [[TreeSitter]] (entity) — underlying parsing library
- [[TypeScriptParser]] (code) — class defined in this module
- [[JavaScriptParser]] (code) — class defined in this module
- `module_id()` (code) — utility for canonical module IDs
- `resolve_import_to_file()` (code) — utility for import path resolution