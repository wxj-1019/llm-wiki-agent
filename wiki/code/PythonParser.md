---
title: "PythonParser"
type: code_class
tags: [code, parser, python, tree-sitter]
sources: [python-code-parser-python-parser-py]
---

## Class: `PythonParser(CodeParser)`

The sole concrete parser for Python files in the code graph extraction framework.

### Location
`python_parser.py` — module ID relative to repo root

### Properties
- `supported_extensions` → `{".py"}`

### Methods

#### `parse(path: Path, repo_root: Path) -> tuple[list[CodeNode], list[CodeEdge]]`
Main entry point. Reads a `.py` file, parses with TreeSitter, walks AST, returns nodes and edges.

**Returns:**
- A module node (`code_module`)
- Edges for `IMPORTS`, `CONTAINS`, `INHERITS`
- Class and function nodes (`code_class`, `code_func`) with parent reference

#### Private helpers:
- `_walk(node, mod_id, path, repo_root, nodes, edges, source)` — dispatched by AST node type
- `_handle_import(...)` — handles `import X` statements
- `_handle_from_import(...)` — handles `from X import Y` statements
- `_handle_class(...)` — extracts class name, base classes, body children
- `_handle_function(...)` — extracts function name, nested inside classes

### Edge Types Produced
| Edge Type | Source → Target | Confidence |
|---|---|---|
| `IMPORTS` | module → module | 1.0 |
| `CONTAINS` | module → class/function | 1.0 |
| `INHERITS` | class → class | 0.8 |

### Dependencies
- [[TreeSitter]] — via `tree_sitter.Language`, `tree_sitter.Parser`, `tree_sitter_python`
- `._utils` — `module_id()`, `resolve_import_to_file()`
- `.base` — `CodeNode`, `CodeEdge`, `CodeParser`
- `.registry` — `register_parser()`