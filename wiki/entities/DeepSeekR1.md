---
title: "DeepSeekR1"
type: entity
tags: [llm, reasoning-model, inference-scaling, open-source]
sources: ['things-we-learned-about-llms-in-2024.md']
---

# DeepSeekR1

DeepSeekR1 is a reasoning-oriented large language model developed by DeepSeek, introduced in 2024 as part of the wave of "inference-scaling" models that emerged alongside OpenAI's [[o1]]. Its main significance lies in demonstrating that advanced step-by-step reasoning capabilities—previously thought to require proprietary techniques—could be achieved with open-weight models and innovative training methods, including reinforcement learning from chain-of-thought traces. In the context of this wiki, DeepSeekR1 represents a key milestone in breaking the [[GPT4]] barrier: it was among the over 70 models from 18 organizations that surpassed the original GPT-4's performance by the end of 2024, while being substantially cheaper to run and openly available. Its rise signals a shift in the LLM landscape toward reasoning models that allocate more compute during inference (scaling compute at test time rather than just during training), making sophisticated problem-solving more accessible and cost-effective. Associated actions include researchers and developers experimenting with its open weights for fine-tuning, evaluating its performance on math, science, and coding benchmarks, and incorporating its reasoning traces into distillation pipelines for smaller models.