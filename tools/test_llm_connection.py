#!/usr/bin/env python3
"""LLM connection diagnostic tool.

Tests connectivity and basic functionality for the configured LLM provider.
Supports DeepSeek, Anthropic, OpenAI, and other litellm-compatible providers.

Usage:
    python tools/test_llm_connection.py
    python tools/test_llm_connection.py --model deepseek/deepseek-chat
    python tools/test_llm_connection.py --env .env
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv


def _load_env(env_path: Path | None = None) -> None:
    """Load .env file if present."""
    if env_path and env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)
    else:
        default = REPO_ROOT / ".env"
        if default.exists():
            load_dotenv(dotenv_path=default, override=False)


def _detect_missing_key(model: str) -> str | None:
    """Return the missing env var name if credentials are absent."""
    m = model.lower()
    mapping = [
        (("deepseek",), "DEEPSEEK_API_KEY"),
        (("anthropic", "claude"), "ANTHROPIC_API_KEY"),
        (("openai", "gpt"), "OPENAI_API_KEY"),
        (("gemini",), "GEMINI_API_KEY"),
    ]
    for prefixes, var in mapping:
        if any(p in m for p in prefixes):
            return None if os.environ.get(var) else var
    return None


async def _test_completion(model: str) -> dict:
    """Run a single completion test. Returns result dict."""
    import litellm

    # Suppress litellm verbose logging
    litellm.set_verbose = False

    prompt = "用一句话回答：北京是中国的什么城市？"
    messages = [{"role": "user", "content": prompt}]

    start = time.time()
    try:
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            max_tokens=100,
            temperature=0.1,
        )
        latency = time.time() - start
        content = response.choices[0].message.content or ""
        usage = getattr(response, "usage", {})
        return {
            "ok": True,
            "latency_ms": round(latency * 1000, 1),
            "content": content.strip(),
            "prompt_tokens": getattr(usage, "prompt_tokens", None),
            "completion_tokens": getattr(usage, "completion_tokens", None),
            "error": None,
        }
    except Exception as e:
        latency = time.time() - start
        return {
            "ok": False,
            "latency_ms": round(latency * 1000, 1),
            "content": "",
            "prompt_tokens": None,
            "completion_tokens": None,
            "error": f"{type(e).__name__}: {e}",
        }


async def _test_json_extraction(model: str) -> dict:
    """Test structured JSON extraction (entity extraction pattern)."""
    import litellm

    prompt = (
        "从以下文本提取关键实体，输出JSON数组:\n"
        "[{\"name\": \"实体名称\", \"type\": \"organization\", \"context\": \"一句话上下文\"}]\n\n"
        "文本: 阿里巴巴和腾讯是中国最大的两家科技公司。"
    )
    messages = [{"role": "user", "content": prompt}]

    start = time.time()
    try:
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            max_tokens=200,
            temperature=0.1,
        )
        latency = time.time() - start
        content = response.choices[0].message.content or ""
        # Try to parse JSON
        import json
        parsed = None
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            # Try to extract from code block
            import re
            m = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
            if m:
                try:
                    parsed = json.loads(m.group(1).strip())
                except json.JSONDecodeError:
                    pass
        return {
            "ok": True,
            "latency_ms": round(latency * 1000, 1),
            "content": content.strip()[:200],
            "parsed_json": parsed is not None,
            "error": None,
        }
    except Exception as e:
        latency = time.time() - start
        return {
            "ok": False,
            "latency_ms": round(latency * 1000, 1),
            "content": "",
            "parsed_json": False,
            "error": f"{type(e).__name__}: {e}",
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="LLM connection diagnostic")
    parser.add_argument("--model", help="Override model name")
    parser.add_argument("--env", type=Path, help="Path to .env file")
    args = parser.parse_args()

    _load_env(args.env)

    model = args.model or os.getenv("LLM_MODEL", "deepseek/deepseek-chat")

    print("=" * 60)
    print("  LLM CONNECTION DIAGNOSTIC")
    print("=" * 60)
    print(f"\nModel: {model}")
    print(f"Repo root: {REPO_ROOT}")

    # Check env
    missing = _detect_missing_key(model)
    if missing:
        print(f"\n[ERROR] Missing API key: {missing}")
        print(f"  -> Set it via:   export {missing}=sk-...")
        print(f"  -> Or add to:    {REPO_ROOT / '.env'}")
        print("\n  .env file template:")
        print(f"    {missing}=your-api-key-here")
        print("\n  Current .env exists:", (REPO_ROOT / ".env").exists())
        return 1
    else:
        print("\n[OK] API key detected")

    # Run tests
    print("\n--- Test 1: Basic Completion ---")
    result1 = asyncio.run(_test_completion(model))
    if result1["ok"]:
        print(f"  Status: PASS")
        print(f"  Latency: {result1['latency_ms']}ms")
        print(f"  Response: {result1['content'][:80]}")
        if result1["prompt_tokens"]:
            print(f"  Tokens: prompt={result1['prompt_tokens']}, completion={result1['completion_tokens']}")
    else:
        print(f"  Status: FAIL")
        print(f"  Error: {result1['error']}")

    print("\n--- Test 2: JSON Structured Extraction ---")
    result2 = asyncio.run(_test_json_extraction(model))
    if result2["ok"]:
        print(f"  Status: PASS")
        print(f"  Latency: {result2['latency_ms']}ms")
        print(f"  JSON parsed: {'YES' if result2['parsed_json'] else 'NO (raw output)'}")
        print(f"  Response preview: {result2['content'][:80]}")
    else:
        print(f"  Status: FAIL")
        print(f"  Error: {result2['error']}")

    print("\n" + "=" * 60)
    if result1["ok"] and result2["ok"]:
        print("  OVERALL: LLM READY")
        print("=" * 60)
        return 0
    else:
        print("  OVERALL: LLM NOT READY")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
