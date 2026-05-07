---
title: "Chain-of-Thought"
type: concept
tags: [prompting, reasoning, llm]
sources: [things-we-learned-about-llms-in-2024]
last_updated: 2026-05-06
---

# Chain-of-Thought

Chain-of-Thought (CoT) prompting is a technique where an LLM is prompted to "think out loud" — producing intermediate reasoning steps before arriving at a final answer. First explored in the May 2022 paper "Large Language Models are Zero-Shot Reasoners", it became the precursor to [[InferenceScalingReasoning]] models in late 2024.

## Evolution

- **2022**: CoT prompting technique discovered: "Let's think step by step"
- **2024**: Baked into model internals as "reasoning tokens" in [[o1]], [[DeepSeekR1]], [[QwQ]]
- The key insight: models that talk through problems often achieve results they wouldn't otherwise

## Connection to Inference-Scaling

[[InferenceScalingReasoning]] models extend CoT by spending variable amounts of compute on internal reasoning — not just visible chain-of-thought but hidden reasoning tokens optimized during training.

## Connections

- [[InferenceScalingReasoning]] — the evolution of CoT into model-native reasoning
- [[o1]] — OpenAI's implementation
- [[DeepSeekR1]] — DeepSeek's implementation
- [[QwQ]] — Qwen's implementation