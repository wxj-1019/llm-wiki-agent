---
title: "Inferred Edge"
type: concept
tags: [graph, llm, inference, relationship]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

An inferred edge is a relationship between two wiki pages detected through semantic analysis by an [[LLM]] during the second pass of the [[BuildGraphTool|Build Graph Tool]]. Unlike [[ExtractedEdge|extracted edges]] (which come from explicit `[[wikilinks]]`), inferred edges reveal implicit connections — themes, shared topics, or conceptual relationships that aren't directly linked in the text. These edges carry a confidence score and are categorized as either `INFERRED` or `AMBIGUOUS` (low confidence).

## Connections

- [[BuildGraphTool]] — generates inferred edges in Pass 2
- [[ExtractedEdge]] — explicit wikilink-based edges (Pass 1)
- [[AmbiguousEdge]] — low-confidence inferred edges
- [[GraphInference]] — the process of generating these edges