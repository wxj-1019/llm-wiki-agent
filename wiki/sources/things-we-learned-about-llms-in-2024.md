---
title: "Things we learned about LLMs in 2024"
type: source
tags: [llm, review, 2024, simon-willison]
date: 2024-12-31
source_file: raw-inbox/batches/batch-web-2026-05-06.md
---

## Summary

[[SimonWillison]]'s comprehensive review of the LLM landscape in 2024, covering the breaking of the [[GPT4]] barrier, plummeting costs, multimodal capabilities, the rise of inference-scaling reasoning models ([[o1]], [[DeepSeekR1]]), and the growing gap between "agents" and practical utility. Also covers environmental impact, synthetic training data, and the challenge of making LLMs usable for non-experts.

## Key Claims

- The GPT-4 barrier was comprehensively broken in 2024 — 70+ models now outrank the original GPT-4 from March 2023, by 18 different organizations.
- GPT-4-class models now run on consumer laptops (e.g., [[LLaMA|Llama 3.3 70B]], [[Qwen|Qwen2.5-Coder-32B]]), a remarkable efficiency gain.
- LLM prices crashed dramatically: GPT-4o is 12x cheaper than GPT-4; Google Gemini 1.5 Flash 8B can process 68,000 images for $1.68.
- Multimodal vision is now ubiquitous across vendors; audio and live video are emerging (ChatGPT Advanced Voice, Gemini live camera).
- Prompt-driven app generation ([[Claude|Claude Artifacts]], GitHub Spark) has become a commodity feature.
- Inference-scaling "reasoning" models ([[o1]], [[DeepSeekR1]], [[QwQ]]) represent a new scaling paradigm: more compute at inference time instead of training time.
- [[DeepSeekV3]] (685B params) was trained for ~$5.6M — 11x less than [[LLaMA|Llama 3.1 405B]] — yet benchmarks near [[Claude|Claude 3.5 Sonnet]].
- "Agents" still haven't really happened — gullibility remains a fundamental roadblock to autonomous action.
- Synthetic training data is now a deliberate advantage, not a crutch, enabling structured learning and small-model distillation.
- LLMs got even harder to use despite greater capability; they remain "chainsaws disguised as kitchen knives".

## Key Quotes

> "The boring yet crucial secret behind good system prompts is test-driven development. You don't write down a system prompt and find ways to test it. You write down tests and find a system prompt that passes them." — [[AmandaAskell]]

> "Those US export regulations on GPUs to China seem to have inspired some *very* effective training optimizations!" — on [[DeepSeekV3]]'s $5.6M training cost

> "Society needs concise ways to talk about modern A.I. — both the positives and the negatives. 'Ignore that email, it's spam,' and 'Ignore that article, it's slop,' are both useful lessons."

## Connections

- [[SimonWillison]] — author of the review, prolific LLM blogger/tool builder
- [[GPT4]] — the benchmark that was comprehensively surpassed in 2024
- [[o1]] — OpenAI's inference-scaling reasoning model (September 2024)
- [[DeepSeekV3]] — cost-efficient 685B model trained for $5.6M
- [[DeepSeekR1]] — DeepSeek's reasoning model that generated training data for V3
- [[Claude]] — Anthropic's model family, Claude 3.5 Sonnet was Willison's favorite in 2024
- [[Gemini]] — Google's multi-modal model with 2M token context
- [[LLaMA]] — Meta's open-weight model family
- [[Qwen]] — Alibaba's model family, including Qwen2.5-Coder and QwQ reasoning model
- [[AIAgent]] — concept discussed critically; agents remain impractical due to gullibility
- [[ChainOfThought]] — precursor technique to inference-scaling reasoning models
- [[AmandaAskell]] — Anthropic researcher, emphasized test-driven development for prompts
- MLX — Apple's ML library for Apple Silicon
- [[NotebookLM]] — Google's audio summary tool with realistic podcast voices
- [[SyntheticData]] — deliberate use of AI-generated training data
- [[Slop]] — term for unwanted AI-generated content, coined in 2024
- [[ModelCollapse]] — theory of degeneration from recursive training data (contrary evidence)
- [[AppleIntelligence]] — Apple's LLM features, described as "bad"

## Contradictions

- Contradicts the [[ModelCollapse]] concern: synthetic data is being used deliberately and effectively, not causing model degeneration.
- Nuances the wiki's current optimistic take on [[AIAgent]]: Willison argues agents haven't really happened yet due to gullibility, contrasting with the Hermes agent's self-improvement framing.
- The environmental impact narrative is split: per-prompt costs dropped dramatically (good), but datacenter buildout is massive (bad)."
