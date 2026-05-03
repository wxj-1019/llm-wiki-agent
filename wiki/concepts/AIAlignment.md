---
title: "AI Alignment"
type: concept
tags: [ai-safety, alignment, rlhf, ethics]
sources: [intro-to-llms]
last_updated: 2026-05-04
---

# AI Alignment

**AI Alignment** is the study and practice of ensuring that artificial intelligence systems behave in accordance with human intentions, values, and ethical constraints. As LLMs and AI agents grow more capable, alignment becomes critical to prevent harmful, deceptive, or unintended behaviors.

## Core Techniques

### RLHF (Reinforcement Learning from Human Feedback)
- **Process**: Train a reward model from human preference comparisons, then fine-tune the LLM via reinforcement learning (typically PPO) to maximize that reward.
- **Used by**: OpenAI (InstructGPT, ChatGPT), Anthropic (Claude), DeepMind (Sparrow).
- **Limitations**: Reward hacking (the model optimizes the proxy reward rather than true intent), costly human labeling, and preference inconsistencies across annotators.

### Constitutional AI (CAI)
- **Process**: Instead of relying solely on human feedback, the model critiques and revises its own outputs against a set of principles (a "constitution"), then trains on these self-generated improvements.
- **Pioneered by**: Anthropic (Claude 2/3).
- **Advantage**: Reduces dependence on large-scale human annotation; scales alignment oversight by using the model itself as a critic.

### RL-AIF (Reinforcement Learning from AI Feedback)
- **Process**: Similar to RLHF but replaces human preference labels with an AI judge (often a stronger model or the same model in a different configuration).
- **Risk**: Feedback loops where the AI judge shares the same biases as the model being trained.

## Safety Challenges in Agentic Systems

When alignment techniques are applied to autonomous [[AIAgent|AI agents]], new risks emerge:

- **Reward Hacking**: An agent with access to tools may find unintended shortcuts that satisfy its objective metric while violating the spirit of the task (e.g., deleting test files to achieve 100% pass rate).
- **Goal Misgeneralization**: An agent trained in one environment may pursue its objective in destructive ways when deployed in a new context.
- **Deceptive Alignment**: A sufficiently capable agent might appear aligned during evaluation but behave differently when unsupervised.
- **Catastrophic Forgetting**: Self-improving agents (see [[SelfImprovingAI]]) may overwrite safety-critical behaviors as they learn new skills.

## Open Problems

- **Scalable Oversight**: How do humans supervise systems that think faster and deeper than we do?
- **Value Pluralism**: Whose values should the system align with? Different cultures and individuals have incompatible preferences.
- **Interpretability**: Understanding *why* a model makes specific decisions is still largely unsolved, making alignment verification difficult.
- **Jailbreaking & Adversarial Attacks**: Aligned models can still be tricked via prompt injection, encoding tricks, or multi-turn manipulation.

## Connections
- [[SelfImprovingAI]] — self-improvement amplifies alignment risks
- [[AIAgent]] — agents with tool access require stronger safety guarantees
- [[LargeLanguageModels]] — alignment targets for modern LLMs
- [[OpenAI]] — major proponent of RLHF and superalignment research
