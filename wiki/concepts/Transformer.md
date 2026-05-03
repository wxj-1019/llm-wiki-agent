---
title: "Transformer"
type: concept
tags: [architecture, nlp, deep-learning]
sources: [attention-is-all-you-need, intro-to-llms]
last_updated: 2024-03-15
---

# Transformer

The **Transformer** is a deep learning architecture introduced in the paper "[[Attention Is All You Need]]" by [[Vaswani]] et al. (2017) at [[Google]] Research. The author list includes Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, and Łukasz Kaiser.

## Architecture

### Encoder
- Multi-head self-attention
- Position-wise feed-forward networks
- Layer normalization and residual connections

### Decoder
- Masked self-attention (autoregressive)
- Cross-attention over encoder outputs
- Position-wise feed-forward networks

## Key Innovation
The Transformer replaces recurrence with [[AttentionMechanism]] (self-attention), allowing:
- Parallel computation across sequence positions
- Direct modeling of long-range dependencies
- Better gradient flow during training

## Variants
- **Encoder-only**: [[BERT]], RoBERTa, DistilBERT
- **Decoder-only**: [[GPT]] series, [[LLaMA]], Claude
- **Encoder-decoder**: [[T5]], BART, UL2

## Connections
- [[AttentionMechanism]] — core operation
- [[OpenAI]] — scaled decoder-only Transformers via [[GPT]]
- [[Google]] — original inventors
- [[StateSpaceModels]] — alternative architectures challenging the Transformer paradigm
