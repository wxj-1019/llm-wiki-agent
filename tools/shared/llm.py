#!/usr/bin/env python3
"""Shared LLM configuration and calling utilities."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


def _get_logger():
    try:
        from tools.shared.logging_config import get_logger
        return get_logger("llm")
    except ImportError:
        import logging
        return logging.getLogger("wiki.llm")


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
    system: str = "",
    temperature: float | None = None,
) -> str:
    """Call the LLM via litellm with config-driven model selection."""
    log = _get_logger()
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

    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "timeout": timeout,
    }
    if api_key:
        kwargs["api_key"] = api_key
    if temperature is not None:
        kwargs["temperature"] = temperature

    prompt_chars = len(prompt)
    log.info("LLM request | model=%s max_tokens=%d prompt_chars=%d system=%s",
             model, max_tokens, prompt_chars, "yes" if system else "no")

    last_err = None
    for attempt in range(max_retries + 1):
        t0 = time.monotonic()
        try:
            response = completion(**kwargs)
            elapsed = time.monotonic() - t0
            content = response.choices[0].message.content
            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "prompt_tokens", None)
            completion_tokens = getattr(usage, "completion_tokens", None)
            total_tokens = getattr(usage, "total_tokens", None)
            log.info("LLM response | model=%s elapsed=%.2fs attempt=%d "
                     "prompt_tokens=%s completion_tokens=%s total_tokens=%s response_chars=%d",
                     model, elapsed, attempt + 1,
                     prompt_tokens, completion_tokens, total_tokens, len(content))
            log.debug("LLM response preview | first_200=%s", content[:200].replace("\n", "\\n"))
            return content
        except Exception as e:
            elapsed = time.monotonic() - t0
            log.warning("LLM call failed | model=%s attempt=%d/%d elapsed=%.2fs error_type=%s error=%s",
                        model, attempt + 1, max_retries + 1, elapsed, type(e).__name__, e)
            last_err = e
            if attempt < max_retries:
                backoff = 2 ** attempt
                log.info("LLM retry in %ds", backoff)
                time.sleep(backoff)
    log.error("LLM all retries exhausted | model=%s attempts=%d", model, max_retries + 1)
    raise last_err
