---
title: "State Space Models"
type: concept
tags: [architecture, ssm, mamba, sequence-modeling]
sources: [intro-to-llms]
last_updated: 2026-05-04
---

# State Space Models

**State Space Models (SSMs)** are a class of sequence models that offer a principled alternative to the [[Transformer]] architecture. Instead of relying on pairwise attention (which scales quadratically with sequence length), SSMs compress the entire sequence into a fixed-size hidden state through linear-time recurrent updates. This makes them theoretically more efficient for very long sequences.

## Core Idea

A state space model defines a mapping from an input sequence $x(t)$ to an output $y(t)$ via a latent state $h(t)$:

- $h'(t) = Ah(t) + Bx(t)$
- $y(t) = Ch(t) + Dx(t)$

In discrete form (for digital implementation), this becomes a recurrent update similar to RNNs but with structured matrices that enable stable gradient flow and efficient parallel training.

## Key Variants

### Mamba (2023)
- **Authors**: Albert Gu & Tri Dao
- **Innovation**: Introduces **selective state spaces**—the matrices $B$, $C$, and step size $\Delta$ are input-dependent, allowing the model to selectively remember or forget information.
- **Advantage**: Matches Transformer quality on language modeling while scaling linearly with sequence length.
- **Limitation**: Struggles with tasks requiring strong recall of specific tokens from distant context ("copying" tasks), as the compressed state may lose fine-grained details.

### Mamba-2 (2024)
- Re-frames selective SSMs through the lens of **structured attention**, revealing a deep theoretical connection between SSMs and attention mechanisms.
- Achieves faster training through hardware-aware algorithms similar to FlashAttention.

### Hyena / Striped Hyena
- Replaces attention with long convolutions and gating mechanisms.
- Demonstrates that subquadratic operators can match Transformer performance when combined with sufficient data and scale.

### Griffin & Hawk (Google DeepMind, 2024)
- **Hawk**: Purely recurrent Gated Linear Recurrent Unit (LRU).
- **Griffin**: Hybrid architecture combining local attention with global recurrent branches.
- Shows that RNN-like recurrence can be competitive when gated and initialized carefully.

## Comparison with Transformers

| Property | Transformer | SSM (Mamba) |
|---|---|---|
| Training parallelization | Yes (full) | Yes (via convolutional mode) |
| Inference speed | O(n²) per token | O(1) per token (constant state) |
| Long-context scaling | Quadratic cost | Linear cost |
| Recall / copying | Strong | Weaker (state compression loss) |
| Ecosystem maturity | Dominant (GPT, LLaMA, Claude) | Emerging |

## When to Use SSMs

- **Very long sequences**: Genomics, audio, time-series forecasting where context exceeds 100k tokens.
- **Resource-constrained inference**: Edge devices where KV-cache memory from Transformers is prohibitive.
- **Streaming applications**: Real-time processing where the model cannot see the full future context.

## Connections
- [[Transformer]] — dominant alternative architecture
- [[AttentionMechanism]] — the operation SSMs seek to replace
- [[LargeLanguageModels]] — SSMs are increasingly integrated into LLM research (e.g., hybrid Transformer-SSM layers)
