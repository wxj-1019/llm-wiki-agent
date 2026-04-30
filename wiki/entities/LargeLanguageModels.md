---
title: "LargeLanguageModels"
type: entity
tags: [llm, neural-network, transformer, language-model]
sources: ['intro-to-llms.md']
---

# LargeLanguageModels

A **Large Language Model (LLM)** is a type of neural network model, typically based on the transformer architecture, trained on massive text corpora to predict and generate human-like text. In the context of this wiki, an LLM is fundamentally a next-token predictor: given a sequence of tokens, it learns to predict the most probable next token(s) through autoregressive generation. The significance of LLMs lies in their emergent properties—abilities that appear abruptly at certain scale thresholds rather than through deliberate programming—including in-context learning, reasoning, translation, and code generation. Scaling laws empirically demonstrate that model capability improves predictably with increases in compute, training data, and parameter count. Architecturally, LLMs can be classified as decoder-only (e.g., [[GPT]]), encoder-only (e.g., [[BERT]]), or encoder-decoder variants, with decoder-only models being the most prevalent for generative tasks in current practice. Actions associated with LLMs include tokenization of input text, autoregressive generation of output sequences, fine-tuning for specific downstream tasks, and evaluation via benchmarks that test reasoning, knowledge, and safety. Key associations include the transformer decoder block (the core component enabling long-range dependencies), attention mechanisms, and emergent abilities that challenge prior assumptions about the nature of machine intelligence.