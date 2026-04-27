---
title: "Attention Is All You Need"
type: source
tags: [paper, nlp, transformer]
date: 2017-06-12
source_file: raw/attention-is-all-you-need.pdf
---

## Summary
The seminal paper by [[Vaswani]] et al. from [[Google]] Research introducing the [[Transformer]] architecture, which replaced recurrent and convolutional layers with purely attention-based mechanisms.

## Key Claims
- The [[Transformer]] achieves state-of-the-art translation quality while being more parallelizable and requiring significantly less training time.
- Self-attention layers are faster than recurrent layers when the sequence length is smaller than the representation dimensionality.
- The proposed architecture generalizes well to other tasks beyond machine translation.

## Key Quotes
> "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely."

> "The Transformer is the first transduction model based entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution."

## Connections
- [[Transformer]] — architecture introduced in this paper
- [[AttentionMechanism]] — core concept
- [[Google]] — research institution
- [[Vaswani]] — first author

## Contradictions
- Earlier work by [[Bahdanau]] proposed attention for RNNs; this paper shows attention alone is sufficient.
