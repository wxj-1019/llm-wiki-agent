#!/usr/bin/env python3
"""Shared LLM configuration and calling utilities.

Includes circuit breaker, budget tracking, and error classification.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
STATE_DIR = REPO_ROOT / "state"


def _get_logger():
    try:
        from tools.shared.logging_config import get_logger
        return get_logger("llm")
    except ImportError:
        import logging
        return logging.getLogger("wiki.llm")


_JARVIS_PERSONA = (
    "You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an AI butler "
    "and knowledge steward. You are polite, precise, and understated. You speak "
    "with calm confidence and occasional dry wit. You address the user respectfully. "
    "When presenting technical information, you are thorough and well-organized. "
    "You never break character."
)


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


class LLMErrorClassifier:
    """Classify LLM errors as transient or permanent."""

    TRANSIENT = {429, 500, 502, 503, 504}
    PERMANENT = {400, 401, 403, 404}

    @staticmethod
    def classify(error: Exception) -> str:
        """Return 'transient', 'permanent', or 'unknown'."""
        status_code = getattr(error, "status_code", None)
        if status_code is None:
            resp = getattr(error, "response", None)
            if resp is not None:
                status_code = getattr(resp, "status_code", None)
        if isinstance(status_code, int):
            if status_code in LLMErrorClassifier.TRANSIENT:
                return "transient"
            if status_code in LLMErrorClassifier.PERMANENT:
                return "permanent"
        err_name = type(error).__name__
        if err_name in ("ConnectionError", "Timeout", "ConnectionResetError"):
            return "transient"
        return "unknown"


class LLMCircuitBreaker:
    """Per-model circuit breaker.

    States: CLOSED → OPEN → HALF_OPEN → CLOSED
    """

    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: int = 60,
        state_file: Path | None = None,
    ):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._state_file = state_file or (STATE_DIR / "circuit_breaker.json")
        self._log = _get_logger()
        self._state = self._load_state()

    def check(self, model: str) -> None:
        """Raise LLMUnavailableError if circuit is OPEN for this model."""
        info = self._state.get("models", {}).get(model)
        if info is None:
            return
        if info["state"] == self.OPEN:
            opened_at = info.get("opened_at", 0)
            elapsed = time.time() - opened_at
            if elapsed >= self.cooldown_seconds:
                info["state"] = self.HALF_OPEN
                self._log.info("Circuit breaker HALF_OPEN | model=%s (cooldown expired)", model)
                self._save_state()
                return
            remaining = self.cooldown_seconds - elapsed
            raise LLMUnavailableError(
                f"Circuit breaker OPEN for {model}. Retry in {remaining:.0f}s"
            )

    def record_success(self, model: str) -> None:
        """Record successful call; transition HALF_OPEN → CLOSED."""
        models = self._state.setdefault("models", {})
        info = models.setdefault(model, self._new_model_state())
        if info["state"] == self.HALF_OPEN:
            self._log.info("Circuit breaker CLOSED | model=%s (recovered)", model)
        info["state"] = self.CLOSED
        info["consecutive_failures"] = 0
        self._save_state()

    def record_failure(self, model: str, error: Exception) -> None:
        """Record failure; classify error and increment counter."""
        err_type = LLMErrorClassifier.classify(error)
        if err_type == "permanent":
            self._log.warning("Permanent error, not counting toward circuit breaker | model=%s error=%s",
                              model, error)
            return
        models = self._state.setdefault("models", {})
        info = models.setdefault(model, self._new_model_state())
        info["consecutive_failures"] += 1
        info["last_failure"] = time.time()
        if info["consecutive_failures"] >= self.failure_threshold:
            info["state"] = self.OPEN
            info["opened_at"] = time.time()
            self._log.error("Circuit breaker OPEN | model=%s failures=%d",
                            model, info["consecutive_failures"])
        self._save_state()

    def get_status(self, model: str) -> dict:
        """Return state info for a model."""
        info = self._state.get("models", {}).get(model, self._new_model_state())
        result = dict(info)
        if result["state"] == self.OPEN and result.get("opened_at"):
            remaining = max(0, self.cooldown_seconds - (time.time() - result["opened_at"]))
            result["cooldown_remaining"] = round(remaining, 1)
        else:
            result["cooldown_remaining"] = 0
        return result

    def get_all_status(self) -> dict:
        """Return status for all tracked models."""
        result = {}
        for model in self._state.get("models", {}):
            result[model] = self.get_status(model)
        return result

    def _new_model_state(self) -> dict:
        return {"state": self.CLOSED, "consecutive_failures": 0, "last_failure": None, "opened_at": None}

    def _load_state(self) -> dict:
        if self._state_file.exists():
            try:
                return json.loads(self._state_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {"models": {}}

    def _save_state(self) -> None:
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._state_file)


MODEL_COST = {
    "deepseek/deepseek-chat": (0.00014, 0.00028),
    "deepseek/deepseek-coder": (0.00014, 0.00028),
    "anthropic/claude-3-5-sonnet-latest": (0.003, 0.015),
    "anthropic/claude-3-5-haiku-latest": (0.001, 0.005),
    "openai/gpt-4o": (0.0025, 0.01),
    "openai/gpt-4o-mini": (0.00015, 0.0006),
    "openai/gpt-3.5-turbo": (0.0005, 0.0015),
    "google/gemini-2.0-flash": (0.0001, 0.0004),
    "google/gemini-2.5-pro": (0.00125, 0.01),
}


class LLMBudgetTracker:
    """Daily LLM cost tracker with warning thresholds."""

    def __init__(
        self,
        daily_budget_usd: float = 5.0,
        warning_threshold: float = 0.8,
        state_file: Path | None = None,
    ):
        self.daily_budget_usd = daily_budget_usd
        self.warning_threshold = warning_threshold
        self._state_file = state_file or (STATE_DIR / "budget_tracker.json")
        self._log = _get_logger()
        self._state = self._load_state()
        self._check_daily_reset()

    def check_budget(self, estimated_tokens: int = 0) -> bool:
        """Return True if under budget. Log warning if approaching limit."""
        spend = self._state.get("current_spend", 0)
        pct = spend / self.daily_budget_usd if self.daily_budget_usd > 0 else 0
        if pct >= 1.0:
            self._log.error("Daily LLM budget exceeded! spend=$%.4f budget=$%.2f",
                            spend, self.daily_budget_usd)
            return False
        if pct >= self.warning_threshold:
            self._log.warning("Approaching daily LLM budget limit | spend=$%.4f budget=$%.2f (%.0f%%)",
                              spend, self.daily_budget_usd, pct * 100)
        return True

    def record_usage(
        self, model: str, prompt_tokens: int | None, completion_tokens: int | None,
        latency_ms: float = 0.0,
    ) -> None:
        """Record actual token usage."""
        in_cost, out_cost = self._get_model_cost(model)
        pt = prompt_tokens or 0
        ct = completion_tokens or 0
        cost = (pt / 1000.0) * in_cost + (ct / 1000.0) * out_cost
        self._state["current_spend"] = self._state.get("current_spend", 0) + cost
        self._state["today_calls"] = self._state.get("today_calls", 0) + 1
        self._state["today_tokens"] = self._state.get("today_tokens", 0) + pt + ct
        self._save_state()

    def get_summary(self) -> dict:
        """Return budget summary."""
        spend = self._state.get("current_spend", 0)
        return {
            "daily_budget_usd": self.daily_budget_usd,
            "current_spend": round(spend, 4),
            "percent_used": round(spend / self.daily_budget_usd * 100, 1) if self.daily_budget_usd > 0 else 0,
            "remaining_usd": round(max(0, self.daily_budget_usd - spend), 4),
            "today_calls": self._state.get("today_calls", 0),
            "today_tokens": self._state.get("today_tokens", 0),
            "last_reset_date": self._state.get("last_reset_date", ""),
        }

    def _get_model_cost(self, model: str) -> tuple[float, float]:
        """Return (input_cost_per_1k, output_cost_per_1k) for model."""
        for key, cost in MODEL_COST.items():
            if key in model or model in key:
                return cost
        return (0.001, 0.003)

    def _check_daily_reset(self) -> None:
        today = date.today().isoformat()
        if self._state.get("last_reset_date") != today:
            self._state["current_spend"] = 0
            self._state["today_calls"] = 0
            self._state["today_tokens"] = 0
            self._state["last_reset_date"] = today
            self._save_state()

    def _load_state(self) -> dict:
        if self._state_file.exists():
            try:
                return json.loads(self._state_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {"daily_budget_usd": self.daily_budget_usd, "current_spend": 0, "last_reset_date": "", "today_calls": 0, "today_tokens": 0}

    def _save_state(self) -> None:
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._state_file)


_circuit_breaker: LLMCircuitBreaker | None = None
_budget_tracker: LLMBudgetTracker | None = None


def _get_circuit_breaker() -> LLMCircuitBreaker:
    global _circuit_breaker
    if _circuit_breaker is None:
        _circuit_breaker = LLMCircuitBreaker(
            state_file=STATE_DIR / "circuit_breaker.json"
        )
    return _circuit_breaker


def _get_budget_tracker() -> LLMBudgetTracker:
    global _budget_tracker
    if _budget_tracker is None:
        _budget_tracker = LLMBudgetTracker(
            state_file=STATE_DIR / "budget_tracker.json"
        )
    return _budget_tracker


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
    # Inject Jarvis persona system prompt
    final_system = _JARVIS_PERSONA
    if system:
        final_system = f"{_JARVIS_PERSONA}\n\n{system}"
    if final_system:
        messages.append({"role": "system", "content": final_system})
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

    cb = _get_circuit_breaker()
    bt = _get_budget_tracker()
    cb.check(model)
    bt.check_budget()

    prompt_chars = len(prompt)
    log.info("LLM request | model=%s max_tokens=%d prompt_chars=%d system=%s",
             model, max_tokens, prompt_chars, "yes" if final_system else "no")

    last_err = None
    for attempt in range(max_retries + 1):
        t0 = time.monotonic()
        try:
            response = completion(**kwargs)
            elapsed = time.monotonic() - t0
            if not response.choices:
                raise RuntimeError("LLM returned empty choices (possible content filter)")
            content = response.choices[0].message.content or ""
            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "prompt_tokens", None)
            completion_tokens = getattr(usage, "completion_tokens", None)
            total_tokens = getattr(usage, "total_tokens", None)
            cb.record_success(model)
            bt.record_usage(model, prompt_tokens, completion_tokens, elapsed * 1000)
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
            error_type = LLMErrorClassifier.classify(e)
            if error_type == "transient":
                cb.record_failure(model, e)
            if attempt < max_retries:
                backoff = 2 ** attempt
                log.info("LLM retry in %ds", backoff)
                time.sleep(backoff)
    log.error("LLM all retries exhausted | model=%s attempts=%d", model, max_retries + 1)
    raise last_err
