---
title: "CodeEdge"
type: concept
tags: [code, graph, dataclass]
sources: [code-graph-base-protocol]
last_updated: 2026-05-14
---

# CodeEdge

`CodeEdge` is a dataclass that represents a directed relationship between two [[CodeNode]]s in a code-level knowledge graph. Key attributes:

- `source`, `target` — node IDs
- `edge_type` — one of `IMPORTS | INHERITS | IMPLEMENTS | CALLS | CONTAINS | DEPENDS_ON`
- `confidence` — float (default 1.0)
- `line` — source code line where the relationship is defined

Predefined edge colors:
- `IMPORTS`: #4CAF50 (green)
- `INHERITS`: #2196F3 (blue)
- `IMPLEMENTS`: #9C27B0 (purple)
- `CALLS`: #FF5722 (deep orange)
- `CONTAINS`: #9E9E9E (grey)
- `DEPENDS_ON`: #795548 (brown)

## Connections

- [[CodeNode]] — the node dataclass
- [[CodeParser]] — the protocol that produces CodeEdge instances
- [[code-graph-base-protocol]] — source document