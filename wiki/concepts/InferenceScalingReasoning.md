---
title: "Inference-Scaling Reasoning"
type: concept
tags: [llm, reasoning, inference, scaling]
sources: [things-we-learned-about-llms-in-2024]
last_updated: 2026-05-06
---

# Inference-Scaling Reasoning

Inference-scaling reasoning (also called "test-time compute scaling") is a new paradigm for LLM capability improvement introduced in late 2024. Instead of improving a model's performance purely through more compute at training time (as with scaling laws), models can now take on harder problems by spending more compute on inference — generating "reasoning tokens" (internal chain-of-thought) before producing final outputs.

## Key Models

- [[o1]] — OpenAI's first reasoning model (September 2024)
- [[o3]] — OpenAI's advanced reasoning model (announced December 2024, achieved ARC-AGI benchmark results with >$1M compute)
- [[DeepSeekR1]] — DeepSeek's reasoning model (November 2024)
- [[QwQ]] — Alibaba Qwen's reasoning model, Apache 2.0 licensed (November 2024)
- [[QvQ]] — vision reasoning model from Qwen (December 2024)
- [[Gemini 2.0 Flash Thinking]] — Google's reasoning entrant (December 2024)

## Relationship to Chain-of-Thought

Extends the [[ChainOfThought]] prompting technique (May 2022) by baking it into the model itself. The model produces "thinking tokens" visible as summaries in some UIs but not directly exposed.

## Implications

- Opens a new axis for scaling beyond training compute
- May enable models to solve much harder problems with sufficient inference budget
- Top models (e.g., o1 Pro) are gated behind expensive subscriptions ($200/month ChatGPT Pro)
- Expected to be adopted by all major labs in 2025

## Connections

- [[ChainOfThought]] — precursor technique
- [[o1]] — pioneering implementation
- [[DeepSeekR1]] — open-weight alternative
- [[ScalingLaws]] — traditional training-time scaling
- [[Qwen]] — Apache 2.0 licensed reasoning models
- [[SimonWillison]] — documented his impressions of these models