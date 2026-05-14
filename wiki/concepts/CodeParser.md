---
title: "CodeParser"
type: concept
tags: [code, parsing, protocol]
sources: [code-graph-base-protocol]
last_updated: 2026-05-14
---

# CodeParser

`CodeParser` is a [[Protocol]] class that defines the unified interface for all language-specific code parsers in a code-level knowledge graph extraction system. Each parser must implement:

- `supported_extensions() -> set[str]` — returns the file extensions the parser handles (e.g., `{'.py'}`).
- `parse(path, repo_root) -> tuple[list[CodeNode], list[CodeEdge]]` — parses a given file and returns the extracted nodes and edges.

This design allows the system to support multiple programming languages through a common abstraction, enabling cross-language code analysis and graph construction.

## Connections

- [[CodeNode]] — the node dataclass returned by parser
- [[CodeEdge]] — the edge dataclass returned by parser
- [[code-graph-base-protocol]] — source document defining the protocol