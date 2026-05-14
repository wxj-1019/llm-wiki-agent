---
title: "Code Graph Registry"
type: concept
tags: [code, graph, parser, registry]
sources: [code-graph-builder-builder-py, code-graph-base-protocol]
last_updated: 2026-05-14
---

# Code Graph Registry

The **Code Graph Registry** is the central extension-to-parser mapping used by the [[CodeGraphBuilder|code graph builder]] (`builder.py`). It provides a `get_parser(filename: str) -> CodeParser | None` function that selects the correct language-specific parser based on file extension. The registry is populated by importing parser modules (e.g., Python, TypeScript parsers) that register themselves. This enables the builder to transparently handle multiple languages without hardcoded logic.

## Related
- [[CodeParser]] — the protocol that all registered parsers must implement
- [[CodeNode]] and [[CodeEdge]] — the data structures produced by parsers
- [[IncrementalGraphBuild]] — the builder's incremental mode using the registry