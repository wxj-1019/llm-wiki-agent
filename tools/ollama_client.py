#!/usr/bin/env python3
"""Ollama client — local LLM fallback for embeddings and chat.

Requires Ollama running locally (default: http://localhost:11434).
Models: nomic-embed-text for embeddings, llama3 for chat.
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Optional

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")


def _post(path: str, data: dict, timeout: int = 60) -> dict:
    url = f"{OLLAMA_URL}{path}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def embed(text: str, model: str = "nomic-embed-text") -> Optional[list[float]]:
    """Generate embedding vector for text."""
    try:
        result = _post("/api/embeddings", {"model": model, "prompt": text})
        return result.get("embedding")
    except Exception:
        return None


def batch_embed(texts: list[str], model: str = "nomic-embed-text") -> list[list[float] | None]:
    """Generate embedding vectors for a batch of texts."""
    if not texts:
        return []
    try:
        result = _post("/api/embed", {"model": model, "input": texts})
        embeddings = result.get("embeddings", [])
        if len(embeddings) != len(texts):
            return [None] * len(texts)
        return embeddings
    except Exception:
        return [None] * len(texts)


def chat(prompt: str, model: str = "llama3", system: str = "") -> Optional[str]:
    """Generate chat completion."""
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        result = _post("/api/chat", {
            "model": model,
            "messages": messages,
            "stream": False,
        })
        return result.get("message", {}).get("content")
    except Exception:
        return None


def is_available() -> bool:
    """Check if Ollama server is reachable."""
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


# ── CLI ──

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Ollama client")
    sub = parser.add_subparsers(dest="cmd")

    p_embed = sub.add_parser("embed", help="Generate embedding")
    p_embed.add_argument("text")
    p_embed.add_argument("--model", default="nomic-embed-text")

    p_chat = sub.add_parser("chat", help="Chat with local LLM")
    p_chat.add_argument("prompt")
    p_chat.add_argument("--model", default="llama3")
    p_chat.add_argument("--system", default="")

    p_check = sub.add_parser("check", help="Check if Ollama is available")

    args = parser.parse_args()

    if args.cmd == "embed":
        vec = embed(args.text, args.model)
        if vec:
            print(json.dumps(vec[:5] + [f"... ({len(vec)} dims)"]))
        else:
            print("Failed to generate embedding", file=sys.stderr)
            sys.exit(1)
    elif args.cmd == "chat":
        reply = chat(args.prompt, args.model, args.system)
        if reply:
            print(reply)
        else:
            print("Failed to get response", file=sys.stderr)
            sys.exit(1)
    elif args.cmd == "check":
        print("Available" if is_available() else "Not available")
    else:
        parser.print_help()
