---
title: "Ambiguous Edge"
type: concept
tags: [graph, llm, inference, relationship, low-confidence]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

An ambiguous edge is a low-confidence relationship inferred between two wiki pages during the second pass of the [[BuildGraphTool|Build Graph Tool]]. The [[LLM]] assigns it when the connection is uncertain, based on weak signals in the text. These edges are displayed with a gray color in the graph visualization to distinguish them from higher-confidence `INFERRED` edges (orange) and deterministic `EXTRACTED` edges (dark gray). Users can filter them out in post-processing.

## Connections

- [[GraphInference]] — the process that produces ambiguous edges
- [[InferredEdge]] — higher-confidence inferred relationships
- [[ExtractedEdge]] — deterministic wikilink-based relationships