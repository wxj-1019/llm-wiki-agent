---
title: "Extracted Edge"
type: concept
tags: [graph, wikilink, edge]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

An extracted edge in the [[BuildGraphTool|Build Graph Tool]] represents an explicit `[[wikilink]]` relationship found in the raw content of a wiki page. These are deterministic: if page A contains `[[PageB]]`, an EXTRACTED edge is created from node A to node B with 100% confidence. This is Pass 1 of the two-pass graph build, requiring no LLM calls. Extracted edges form the backbone of the knowledge graph, while inferred edges (from Pass 2) add supplementary connections.

## Connections

- [[BuildGraphTool]] — extracts these edges in Pass 1
- [[InferredEdge]] — the counterpart from Pass 2 (LLM analysis)
- [[AmbiguousEdge]] — low-confidence inferred edges
- [[wikilink]] — the markup syntax that creates these edges