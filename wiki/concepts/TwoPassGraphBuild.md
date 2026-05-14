---
title: "Two-Pass Graph Build"
type: concept
tags: [graph, build, workflow]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

The two-pass graph build is the architecture of the [[BuildGraphTool|Build Graph Tool]]: Pass 1 (Parse) extracts all explicit `[[wikilinks]]` from wiki pages without any LLM calls, producing deterministic `EXTRACTED` edges. Pass 2 (Infer) uses an [[LLM]] to analyze page content and detect implicit relationships, producing `INFERRED` and `AMBIGUOUS` edges with confidence scores. This separation ensures that the core graph (Pass 1) is always fast and deterministic, while Pass 2 adds richer but more expensive semantic connections.

## Connections

- [[BuildGraphTool]] — implements the two-pass architecture
- [[ExtractedEdge]] — results from Pass 1
- [[InferredEdge]] — results from Pass 2
- [[AmbiguousEdge]] — low-confidence results from Pass 2