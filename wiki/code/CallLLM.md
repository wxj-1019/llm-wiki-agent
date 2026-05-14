---
title: call_llm()
type: code_func
tags: [query, llm, utility]
sources: [query-tool-llm-wiki-query-engine]
last_updated: 2026-05-14
---

# `call_llm(prompt, model_env, default_model, max_tokens=4096) -> str`

**Defined in:** `tools/query.py` (inline fallback defined in `# ── Shared LLM utilities` section)

## Purpose
Calls an [[LLM]] via `litellm` to generate a response. Uses `_load_llm_config()` to read `config/llm.yaml` for model, provider, and API key. Constructs a single-turn user prompt and returns the message content.

## Parameters
- `prompt` (str) — The user prompt to send.
- `model_env` (str) — Environment variable name for model override (not used in this fallback; model comes from config).
- `default_model` (str) — Fallback model string if config/yaml is missing.
- `max_tokens` (int) — Max output tokens (default 4096).

## Returns
- `str` — The LLM's response text from `response.choices[0].message.content`.

## Raises
- `RuntimeError` — If `litellm` is not installed.

## Connections
- [[LLM]] (concept) — the underlying model backend
- [[config/llm.yaml]] (config) — central LLM provider/model/API key config
- [[Litellm]] (entity) — library used for completion API