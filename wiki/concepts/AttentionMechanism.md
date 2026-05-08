---
title: "Attention Mechanism"
type: concept
tags: [neural-network, attention]
sources: [graph-rebuild-verify]
last_updated: 2026-05-08
---

## Summary

The attention mechanism is a neural network technique that allows the model to focus on specific parts of the input sequence when generating output. It was first introduced for machine translation and later became the foundation of the [[Transformer]] architecture.

## Key Ideas

- Computes a weighted sum of values based on compatibility between query and key vectors
- Enables handling of long-range dependencies without recurrence
- Variants include self-attention, cross-attention, and multi-head attention

## Connections

- [[Transformer]] — the architecture that relies solely on attention mechanisms
- [[DeepLearning]] — attention is a key component of modern deep learning models