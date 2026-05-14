---
title: "Code Graph Extraction Base Protocol"
type: source
tags: [code, graph, protocol, python]
date: 2026-05-14
source_file: raw/base.py
---

## Summary

Defines the base protocol and dataclasses for a language-agnostic code-level knowledge graph extraction system. The `CodeParser` protocol provides a unified interface that every language parser must implement, producing lists of `CodeNode` and `CodeEdge` objects representing the structural and relational information of source code.

## Key Claims

- A `CodeNode` represents a code element (module, class, function, interface) with an ID, label, type, path, language, optional parent, and line range.
- A `CodeEdge` represents a relationship between two code nodes: `IMPORTS`, `INHERITS`, `IMPLEMENTS`, `CALLS`, `CONTAINS`, or `DEPENDS_ON`, with a confidence score and source line.
- The `CodeParser` protocol defines a standard interface (`parse` method) that all language-specific parsers must implement, returning `(list[CodeNode], list[CodeEdge])`.
- Edge colors are predefined per type to facilitate visualization.

## Key Quotes

> "Unified interface that every language parser must implement."

## Connections

- [[CodeParser]] (concept) — the core protocol for language-specific code parsers
- [[CodeNode]] (concept) — the dataclass representing code-level nodes
- [[CodeEdge]] (concept) — the dataclass representing relationships between code nodes

## Contradictions

None.