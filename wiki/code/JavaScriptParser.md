---
title: "JavaScriptParser — JavaScript/JSX AST Parser"
type: code_class
tags: [code, parser, javascript, tree-sitter]
---

# JavaScriptParser

Implements [[CodeParser]] for `.js` and `.jsx` files using [[TreeSitter]] [[typescript_javascript_code_parser_typescript_parser_py|typescript_parser.py]].

## Implements
- `supported_extensions` → `{".js", ".jsx"}`
- `parse(path, repo_root)` → `(nodes, edges)`

## Internal Methods
| Method | Purpose |
|---|---|
| `_walk_children(node, mod_id, path, repo_root, nodes, edges)` | Recursive AST traversal (similar to [[TypeScriptParser]] but without variable→arrow_function extraction) |
| `_handle_import(node, mod_id, path, repo_root, edges)` | Extract `import` statements → `IMPORTS` edges |
| `_handle_class(node, mod_id, path, repo_root, nodes, edges)` | Extract classes → `CONTAINS` + `INHERITS` edges (class_heritage with extends_clause/member_expression support) |
| `_handle_function(node, mod_id, path, repo_root, nodes, edges)` | Extract named functions → `CONTAINS` edges |

## Key Features
- Simpler than [[TypeScriptParser]] — lacks `_handle_variable` and arrow function promotion
- Unwraps `export_statement` for inner declarations
- Resolves imports via string source nodes
- Recurses into `statement_block`, `class_body`, `program` for nested definitions

## Connections
- [[TypeScriptParser]] — sibling parser for `.ts`/`.tsx` files
- [[CodeGraphRegistry]] — registered via `register_parser()`
- [[PythonParser]] — sibling parser for Python files