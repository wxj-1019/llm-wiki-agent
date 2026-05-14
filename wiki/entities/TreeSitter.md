---
title: "TreeSitter"
type: entity
tags: [tool, parser]
sources: [python-code-parser-python-parser-py, code-graph-base-protocol]
---

**TreeSitter** is a parser generator tool and incremental parsing library used in the LLM Wiki for AST extraction from source code files. It is a core dependency of `python_parser.py` and the broader [[CodeGraphRegistry]] framework.

### Usage in This Wiki
- [[PythonParser]] uses `tree_sitter` and `tree_sitter_python` to parse `.py` files and extract nodes/edges.
- Requires the `tree-sitter` Python package and language-specific grammar libraries (e.g., `tree-sitter-python`).

### Connections
- [[CodeParser]] — TreeSitter is used to implement this base protocol
- [[CodeGraphBuilder]] — the high-level builder that orchestrates parsing
- [[PythonParser]] — the concrete implementation for Python