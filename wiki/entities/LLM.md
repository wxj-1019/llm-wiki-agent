---
title: "LLM"
type: entity
tags: [large-language-model, ai, inference, query]
sources: [CallLLM.md, HealthChecker.md, QueryMain.md, build-graph-tool-knowledge-graph-builder.md, query-tool-llm-wiki-query-engine.md, shared-llm-module.md]
---

# LLM

In the context of this wiki, "LLM" refers to the core large language model inference capability that powers the entire wiki's query and knowledge synthesis pipeline. It is not a single model or instance, but rather a configurable abstraction: the system reads model, provider, and API key settings from `config/llm.yaml` via the shared `tools/shared/llm.py` module, and then routes all requests through litellm with robust features including a J.A.R.V.I.S.-persona prompt overlay, a circuit breaker for per-model failure isolation, a budget tracker for cost governance, and an error classifier with exponential backoff retry. The LLM is invoked directly by `call_llm()` for single-turn generation and indirectly by `query()` for multi-step retrieval-augmented synthesis, wherein the system loads agent memory, finds relevant wiki pages via index and graph-based neighbor expansion, and passes their content as context before generating an answer. The LLM is also employed by the knowledge graph builder to infer implicit relationships between pages, producing `INFERRED` edges with confidence scores. Notably, the structural health checker (`health.py`) deliberately makes zero LLM calls, underscoring that the LLM is reserved strictly for semantic and generative tasks, while deterministic diagnostics remain purely rule-based. As such, the LLM represents the wiki's intelligent inference layer—the component that transforms the wiki from a static document store into an interactive, queryable knowledge base.