---
title: "Foundation Models Overview"
type: synthesis
tags: [overview, llm, foundation-models]
sources: [intro-to-llms, attention-is-all-you-need]
last_updated: 2024-03-25
---

# Foundation Models Overview

Foundation models are large-scale AI models trained on broad data that can be adapted to a wide range of downstream tasks.

## The Transformer Era

The modern foundation model era began with the [[Transformer]] architecture (2017), which introduced [[AttentionMechanism|self-attention]] as a replacement for recurrent layers. [[Google]] invented it; [[OpenAI]] scaled it.

## Key Model Families

| Model | Architecture | Organization | Notable Feature |
|---|---|---|---|
| [[GPT]] | Decoder-only | [[OpenAI]] | Autoregressive generation |
| [[BERT]] | Encoder-only | [[Google]] | Bidirectional understanding |
| [[T5]] | Encoder-decoder | [[Google]] | Text-to-text framework |
| [[LLaMA]] | Decoder-only | Meta | Open weights |

## Scaling Laws

Model capability improves predictably with:
- Compute (FLOPs)
- Data (tokens)
- Parameters (model size)

## Connections
- [[Transformer]] — universal architecture
- [[AttentionMechanism]] — core mechanism
- [[OpenAI]] — commercial leader
- [[Google]] — research leader
