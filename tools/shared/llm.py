#!/usr/bin/env python3
"""Shared LLM configuration and calling utilities."""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


def _load_llm_config() -> dict:
    """Load LLM config from config/llm.yaml with sensible defaults."""
    cfg_path = REPO_ROOT / "config" / "llm.yaml"
    defaults = {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-latest",
        "api_key": "",
        "api_base": "",
    }
    if cfg_path.exists():
        try:
            import yaml

            data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
            return {**defaults, **data}
        except Exception as exc:
            import logging
            logging.getLogger("wiki_llm").warning("Failed to load LLM config from %s: %s", cfg_path, exc)
    return defaults


class LLMUnavailableError(Exception):
    """Raised when the LLM backend (litellm) is not installed or misconfigured."""
    pass


def call_llm(
    prompt: str,
    model_env: str = "LLM_MODEL",
    default_model: str = "claude-3-5-sonnet-latest",
    max_tokens: int = 4096,
    max_retries: int = 2,
    timeout: int = 120,
) -> str:
    """Call the LLM via litellm with config-driven model selection."""
    try:
        from litellm import completion
    except ImportError as exc:
        raise LLMUnavailableError(
            "litellm not installed. Run: pip install litellm"
        ) from exc

    cfg = _load_llm_config()
    model = cfg.get("model") or os.getenv(model_env, default_model)
    provider = cfg.get("provider", "anthropic")
    if "/" not in model:
        model = f"{provider}/{model}"
    api_key = cfg.get("api_key", "")

    kwargs: dict = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "timeout": timeout,
    }
    if api_key:
        kwargs["api_key"] = api_key

    last_err = None
    for attempt in range(max_retries + 1):
        try:
            response = completion(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                import time
                time.sleep(2 ** attempt)
    raise last_err
