---
title: "Overview"
type: synthesis
tags: []
sources: [attention-is-all-you-need, intro-to-llms]
last_updated: 2026-04-30
---

# Overview

*This page is maintained by the LLM. It is updated on every ingest to reflect the current synthesis across all sources.*

## Current Wiki State

The wiki contains **2 sources**, **15 entities**, **2 concepts**, and **1 synthesis** — a total of 20 pages forming a knowledge graph centered on the Transformer architecture and large language models.

### Sources
- [[Attention Is All You Need]] — the seminal paper introducing the Transformer architecture
- [[intro-to-llms]] — a comprehensive overview of LLMs

### Key Themes
1. **The Transformer Architecture** — The foundational innovation that replaced recurrence with self-attention, enabling parallel training and better handling of long-range dependencies. [[Google]] invented it; [[OpenAI]] scaled it.
2. **Attention Mechanisms** — The core computation behind Transformers: scaled dot-product attention, multi-head attention, and variants like causal/masked attention.
3. **Scaling Laws** — Model capability improves predictably with compute, data, and parameters. Emergent abilities appear at certain scale thresholds.
4. **The LLM Ecosystem** — The rise of decoder-only models ([[GPT]], [[GPT4]], [[ChatGPT]], [[LLaMA]]), bidirectional encoders ([[BERT]]), encoder-decoder models ([[T5]]), and the competitive landscape between labs.

### Key Entities
- **Organizations**: [[Google]], [[OpenAI]]
- **Researchers**: [[Vaswani]], [[Bahdanau]], [[SamAltman]], [[IlyaSutskever]], [[GregBrockman]]
- **Model Families**: [[GPT]], [[GPT4]], [[ChatGPT]], [[BERT]], [[T5]], [[LLaMA]], [[LargeLanguageModels]]

### Contradictions & Open Questions
- Whether emergent abilities in LLMs are a fundamental property or a metric artifact is debated
- The original work by [[Bahdanau]] introduced attention for RNNs; the Transformer paper demonstrated attention alone is sufficient

### Knowledge Gaps
- No sources yet on: RLHF, multimodal models, open-source LLM ecosystem
- Missing concept pages for: scaling laws, RLHF, prompt engineering, fine-tuning
