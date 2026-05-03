---
title: "NousResearch"
type: entity
tags: [organization, ai-research, open-source]
sources: [github-hermes-ecosystem]
last_updated: 2026-05-04
---

## Overview

NousResearch is a decentralized, open-source AI research collective known for pushing the boundaries of autonomous AI agents and openly shared model fine-tunes. Unlike traditional corporate labs, NousResearch operates as a distributed community of researchers, engineers, and artists collaborating on public infrastructure for AI. Its work spans from agent frameworks to fine-tuned language models and synthetic data generation.

## Key Projects

### Agent & Infrastructure
- **[[HermesAgent]]** — 自我进化的 AI Agent 框架，支持多种 LLM 提供商与多平台部署
- **hermes-agent-self-evolution** — 基于 DSPy + GEPA 的进化式自我改进系统

### Model Fine-Tunes
- **Nous-Hermes** — A family of fine-tuned LLaMA and Mistral models optimized for general instruction following and reasoning. Early releases (Nous-Hermes 1, 2) demonstrated that small, open models could match larger proprietary counterparts with high-quality data curation.
- **Capybara** — A series of conversational fine-tunes focused on roleplay, creative writing, and long-context coherence.
- **Yi-Coder / Code models** — Specialized fine-tunes for code generation and software engineering tasks.

### Research Contributions
- **Synthetic Data Pipelines** — NousResearch pioneered the use of synthetic data generation for model fine-tuning, showing that carefully curated synthetic dialogues can outperform hand-collected human datasets.
- **GEPA (Gradient-free Evolutionary Prompt Adjustment)** — An evolutionary algorithm for optimizing prompts without backpropagation, enabling agents to improve their own instructions over time.

## Philosophy

- **Open Weights**: All major model releases include downloadable weights and training recipes, enabling full reproducibility and downstream customization.
- **Model Agnosticism**: Tools are designed to work across providers (OpenAI, Anthropic, local models via Hugging Face, etc.), preventing vendor lock-in.
- **Self-Improvement as Default**: The organization views autonomous learning and skill creation as essential properties of next-generation AI systems, not optional add-ons.
- **Decentralized Collaboration**: Research happens in public Discord servers and open GitHub repositories, with contributions from a global community rather than a centralized lab structure.

## Connections

- [[HermesAgent]] — 核心项目
- [[AIAgent]] — 所属领域
- [[SelfImprovingAI]] — 研究理念
- [[OpenAI]] — 支持的 LLM 提供商之一
- [[Meta]] — LLaMA 系列模型的来源（Nous-Hermes 基于 LLaMA）
