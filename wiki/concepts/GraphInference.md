---
title: "Graph Inference"
type: concept
tags: [graph, llm, inference, relationship]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

Graph inference is the second pass of the [[BuildGraphTool|Build Graph Tool]] workflow. After parsing explicit `[[wikilinks]]` (Pass 1: EXTRACTED edges), Pass 2 uses an [[LLM]] via `litellm` to analyze page content and detect implicit relationships between pages that don't share explicit wikilinks. These inferred edges are assigned confidence scores: `INFERRED` (high confidence) and `AMBIGUOUS` (low confidence). The inference process is checkpointed to `.inferred_edges.jsonl` for crash recovery, and `--no-infer` flag allows skipping this token-intensive step.

## Key Claims

- Inferring relationships between unrelated-seeming wiki pages (e.g., a financial concept and a developer's resume that share a tech dependency)
- Assigning confidence levels to filter low-quality edges
- Checkpoint-based resume for long inference runs
- Configurable via `--max-infer` to limit inference cost

## Connections

- [[BuildGraphTool]] — implements this inference pipeline
- [[LLM]] — the engine for semantic analysis
- [[Litellm]] — the API gateway for LLM calls
- [[InferredEdge]] — the result of graph inference
- [[AmbiguousEdge]] — low-confidence inferred edges