---
title: "CodeNode"
type: concept
tags: [code, graph, dataclass]
sources: [code-graph-base-protocol]
last_updated: 2026-05-14
---

# CodeNode

`CodeNode` is a dataclass that represents a single node in a code-level knowledge graph. It captures structural information about a code element:

- `id` — unique identifier
- `label` — human-readable name
- `type` — `code_module | code_class | code_func | code_interface`
- `path` — file path relative to repo root
- `language` — programming language
- `parent` — optional parent node ID (e.g., module containing a class)
- `line_start`, `line_end` — source code line range
- `extra` — dictionary for additional metadata

## Connections

- [[CodeParser]] — the protocol that produces CodeNode instances
- [[CodeEdge]] — related dataclass for relationships
- [[code-graph-base-protocol]] — source document