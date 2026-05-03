---
title: "LLaMA"
type: entity
tags: ['llm', 'meta', 'open-source', 'foundation-model']
sources: ['overview', 'foundation-models-overview']
last_updated: 2026-05-04
---

# LLaMA

LLaMA (Large Language Model Meta AI) is a family of large language models developed by [[Meta]], designed as a research-focused alternative to proprietary closed-source models like [[OpenAI]]'s [[GPT]] series and [[Google]]'s Gemini. Architecturally, LLaMA is a decoder-only [[Transformer]]-based model using self-attention mechanisms as introduced in [[Attention Is All You Need]].

## Model Versions

### LLaMA 1 (2023)
- Released with model weights under a non-commercial academic license.
- Parameter sizes: 7B, 13B, 33B, 65B.
- Sparked a wave of open-source fine-tuned variants such as Alpaca and Vicuna.

### LLaMA 2 (2023)
- Released under a more permissive commercial license.
- Introduced Grouped-Query Attention (GQA) to improve inference speed.
- Parameter sizes: 7B, 13B, 70B, plus a code-specialized Code LLaMA variant.

### LLaMA 3 (2024)
- Significantly expanded training data and context window.
- Improved reasoning, coding, and multilingual capabilities.
- Parameter sizes: 8B, 70B, and 405B (the largest open-weight model at release).

### Future Directions
- Meta has signaled continued investment in open-weight models, with expectations around Mixture-of-Experts (MoE) architectures, expanded multimodal support, and longer context windows in subsequent releases. Specific details beyond LLaMA 3 should be sourced from official Meta AI announcements.

## Significance

By releasing model weights, Meta democratized access to powerful LLM capabilities, enabling researchers, startups, and independent developers to fine-tune, study, and deploy high-performing models without proprietary API costs. This open-weight strategy directly challenged the dominance of closed-source foundation models and catalyzed the broader open-source AI ecosystem.

## Connections
- [[Meta]] — developing organization
- [[GPT]] — primary closed-source competitor family
- [[Transformer]] — core architecture
- [[AttentionMechanism]] — foundational operation
