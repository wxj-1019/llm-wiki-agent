---
title: "BERT"
type: entity
tags: [llm, encoder, nlp, google]
sources: [overview.md, intro-to-llms.md, foundation-models-overview.md]
---

# BERT

**BERT (Bidirectional Encoder Representations from Transformers)** is a foundational natural language processing model developed by [[Google]] that introduced an **encoder-only** [[Transformer]] architecture, distinguishing it from decoder-only models like [[GPT]]. Unlike autoregressive models that predict tokens in a single direction, BERT leverages bidirectional context by simultaneously attending to both left and right tokens during pre-training, enabling deeper language understanding.

Released in 2018, BERT fundamentally reshaped NLP by demonstrating that bidirectional pre-training on large unlabeled corpora could be fine-tuned to achieve state-of-the-art results on numerous downstream tasks. As an encoder-only model, BERT produces rich contextualized word embeddings suitable for classification and understanding tasks but does not natively support autoregressive text generation like [[GPT]]. Its architecture directly influenced modern encoder systems and remains a benchmark for evaluating language understanding capabilities, though it has been succeeded by more compute-efficient variants.