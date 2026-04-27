---
title: "Attention Mechanism"
type: concept
tags: [mechanism, nlp, deep-learning]
sources: [attention-is-all-you-need]
last_updated: 2024-02-28
---

# Attention Mechanism

**Attention** is a technique in neural networks that allows models to focus on specific parts of the input when producing each part of the output.

## Self-Attention

In self-attention, each position in the sequence attends to all other positions:

```
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V
```

Where:
- **Q** (Query): What am I looking for?
- **K** (Key): What do I contain?
- **V** (Value): What information do I provide?

## Multi-Head Attention
Multiple attention heads operate in parallel, allowing the model to jointly attend to information from different representation subspaces.

## Types
- **Scaled Dot-Product Attention**: Used in the [[Transformer]]
- **Cross-Attention**: Queries from one sequence attend to keys/values from another
- **Causal/Masked Attention**: Prevents attending to future positions (used in [[GPT]])

## Connections
- [[Transformer]] — architecture built entirely on attention
- [[GPT]] — uses causal self-attention
- [[BERT]] — uses bidirectional self-attention
- [[OpenAI]] — pioneered scaling attention-based models
