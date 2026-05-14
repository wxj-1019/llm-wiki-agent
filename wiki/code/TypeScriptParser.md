---
title: "TypeScriptParser — TypeScript/TSX AST Parser"
type: code_class
tags: [code, parser, typescript, tree-sitter]
---

# TypeScriptParser

Implements [[CodeParser]] for `.ts` and `.tsx` files using [[TreeSitter]] [[typescript_javascript_code_parser_typescript_parser_py|typescript_parser.py]].

## Implements
- `supported_extensions` → `{".ts", ".tsx"}`
- `parse(path, repo_root)` → `(nodes, edges)`

## Internal Methods
| Method | Purpose |
|---|---|
| `_walk_children(node, mod_id, path, repo_root, nodes, edges)` | Recursive AST traversal dispatching to specialized handlers |
| `_handle_import(node, mod_id, path, repo_root, edges)` | Extract `import` statements → `IMPORTS` edges |
| `_handle_class(node, mod_id, path, repo_root, nodes, edges)` | Extract classes → `CONTAINS` + `INHERITS` edges |
| `_handle_function(node, mod_id, path, repo_root, nodes, edges)` | Extract named functions → `CONTAINS` edges |
| `_handle_variable(node, mod_id, path, repo_root, nodes, edges)` | Extract `const X = () => {}` → `code_func` nodes |

## Key Features
- Detects arrow functions assigned to `const`/`let` variables and promotes them to `code_func` nodes
- Unwraps `export_statement` to find inner declarations
- Resolves inheritance via `class_heritage` AST subtrees with `extends_clause` and `member_expression` support
- Skips self-imports when resolving import paths

## Connections
- [[JavaScriptParser]] — sibling parser for `.js`/`.jsx` files
- [[CodeGraphRegistry]] — registered via `register_parser()`
- [[PythonParser]] — sibling parser for Python files