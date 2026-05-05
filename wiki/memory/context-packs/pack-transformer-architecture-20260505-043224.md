---
title: "Context Pack: transformer architecture"
type: synthesis
tags: [context-pack, memory]
date: 2026-05-05
goal: "transformer architecture"
target: "wiki/concepts/Transformer.md"
budget: 3000
---

# Context Pack: transformer architecture

**Budget**: 3000 tokens | **Pages**: 1 | **Estimated**: 306 tokens

## Pages

### Transformer (target)
*Path*: `wiki\concepts\Transformer.md`

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

---
