---
title: "Litellm"
type: entity
tags: [llm, library, api, provider]
sources: [CallLLM.md, build-graph-tool-knowledge-graph-builder.md]
---

# Litellm

**Litellm** is an open-source Python library that provides a unified interface for calling hundreds of large language model providers — including OpenAI, Anthropic, Google, Azure, and local models — by abstracting away provider-specific API differences behind a single function call. Within this wiki, Litellm serves as the foundational LLM integration layer: it powers `call_llm()`, the central utility function used to generate responses for queries, and is also employed during the knowledge graph build process in `build_graph.py` to perform LLM inference for detecting implicit relationships between wiki pages. Its significance lies in enabling provider-agnostic, configurable model routing — the system reads model, provider, and API key details from a YAML configuration file (`config/llm.yaml`) and passes them to Litellm, allowing seamless switching between models without changing code. By handling token limits, response parsing, and error management consistently, Litellm ensures that both the query engine and the graph builder can depend on a stable, predictable LLM interaction layer across diverse use cases — from single-turn prompt responses to batch inference over hundreds of page pairs.