---
title: "LargeLanguageModels"
type: entity
tags: [llm, neural-network, transformer, language-model]
sources: ['intro-to-llms']
last_updated: 2026-05-04
---

# LargeLanguageModels

A **Large Language Model (LLM)** is a type of neural network model, typically based on the [[Transformer]] architecture, trained on massive text corpora to predict and generate human-like text. In the context of this wiki, an LLM is fundamentally a next-token predictor: given a sequence of tokens, it learns to predict the most probable next token(s) through autoregressive generation.

## Emergent vs. Deliberately Trained Capabilities

Early LLMs exhibited **emergent abilities**—capabilities that appeared abruptly at certain scale thresholds, including in-context learning, translation, and code generation. However, modern models have moved beyond purely emergent properties:

- **Chain-of-Thought (CoT)**: Models can be prompted to generate intermediate reasoning steps, drastically improving performance on mathematical and logical tasks. Introduced in "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (Wei et al., 2022).
- **Test-Time Compute**: Recent reasoning models (e.g., OpenAI's o-series) deliberately allocate additional computation at inference time to refine answers through internal reasoning chains, rather than relying solely on pre-trained weights.
- **Tool Use**: Modern LLMs integrate with external tools (calculators, search engines, APIs) via function calling, extending their capabilities beyond static parametric knowledge.
- **Multimodality**: GPT-4o, Gemini, and Claude 3 process not only text but also images, audio, and video, representing a shift from pure language modeling to unified multimodal reasoning.

## Scaling Laws

Scaling laws empirically demonstrate that model capability improves predictably with increases in compute, training data, and parameter count. Key milestones include:
- **Kaplan et al. (2020)**: Established power-law relationships between loss and model size/data/compute.
- **Chinchilla (2022)**: Demonstrated that many models were under-trained; compute-optimal training requires balancing model size with training token count.

## Architectural Variants

- **Decoder-only**: [[GPT]] series, [[LLaMA]], Claude — autoregressive generation, dominant for generative tasks.
- **Encoder-only**: [[BERT]], RoBERTa — bidirectional understanding, prevalent in classification and retrieval.
- **Encoder-decoder**: [[T5]], BART — structured for translation and summarization.

## Connections
- [[Transformer]] — core architecture
- [[GPT]] — influential decoder-only LLM family
- [[BERT]] — influential encoder-only LLM
- [[AttentionMechanism]] — key operation enabling long-range dependencies
- [[AIAgent]] — LLMs serve as the cognitive backbone of modern agents
- [[StateSpaceModels]] — emerging alternatives to Transformer-based LLMs
