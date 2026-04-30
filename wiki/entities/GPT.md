---
title: "GPT"
type: entity
tags: [model, architecture, openai, decoder-only]
sources: [overview.md, intro-to-llms.md, foundation-models-overview.md]
---

# GPT

**GPT** (Generative Pre-trained Transformer) is a family of decoder-only large language models developed by OpenAI that pioneered the modern era of foundation models and autoregressive text generation. Unlike encoder-only models such as [[BERT]], which are optimized for understanding tasks, GPT models are designed to predict the next token in a sequence, enabling them to generate coherent, contextually relevant text across a wide range of domains. The GPT architecture, introduced with the Transformer innovation from the [[Attention Is All You Need]] paper, replaces recurrent layers with self-attention mechanisms and scales predictably according to scaling laws — meaning capability improves with increased compute, data, and parameters. As documented in the wiki sources, GPT represents a key connection point linking [[OpenAI]]'s scaling strategy, the [[Transformer]] architecture's decoder-only branch, and the broader foundation model ecosystem. Its significance lies in demonstrating that simple next-token prediction at sufficient scale yields emergent abilities, reshaping the field's understanding of machine intelligence. Actions associated with GPT in this knowledge graph include functioning as the primary exemplar of autoregressive generation, illustrating scaling law behavior, and serving as a foundational architecture from which many modern LLMs derive.