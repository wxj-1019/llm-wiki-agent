#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def parse_llm_json(raw: str) -> list | dict | None:
    """Strip markdown fences and parse JSON from LLM output.
    Returns a list or dict, or None if parsing fails.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        try:
            first_newline = cleaned.index("\n")
            last_backtick = cleaned.rindex("```")
            cleaned = cleaned[first_newline + 1 : last_backtick].strip()
        except ValueError:
            pass
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, (list, dict)):
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def load_yaml_config(path: str | Path, defaults: dict | None = None) -> dict:
    """Load a YAML config file with fallback defaults.
    Returns a dict (never None).
    """
    result: dict = dict(defaults) if defaults else {}
    p = Path(path)
    if not p.exists():
        return result
    try:
        import yaml
        with open(p, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict):
            result.update(data)
        return result
    except Exception:
        return result


import subprocess
from datetime import datetime


def safe_subprocess(
    cmd: list[str] | str,
    cwd: str | None = None,
    timeout: int = 60,
    shell: bool = False,
    capture_output: bool = True,
) -> dict:
    """Run a subprocess with safe defaults. Returns dict with stdout, stderr, returncode, duration_ms."""
    result: dict = {"stdout": "", "stderr": "", "returncode": -1, "duration_ms": 0}
    start = datetime.now()
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            timeout=timeout,
            shell=shell,
            capture_output=capture_output,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        result["stdout"] = proc.stdout or ""
        result["stderr"] = proc.stderr or ""
        result["returncode"] = proc.returncode
    except subprocess.TimeoutExpired as exc:
        result["stderr"] = f"Timed out after {timeout}s"
        result["stdout"] = exc.stdout or ""
        result["returncode"] = -1
    except FileNotFoundError:
        result["stderr"] = f"Command not found: {cmd}"
        result["returncode"] = -1
    except Exception as exc:
        result["stderr"] = str(exc)
        result["returncode"] = -1
    result["duration_ms"] = int((datetime.now() - start).total_seconds() * 1000)
    return result


def normalize_path(user_path: str, base_dir: str) -> Path | None:
    """Resolve a user-provided path relative to base_dir, with traversal protection.
    Returns resolved Path or None if traversal detected.
    """
    try:
        base = Path(base_dir).resolve()
        target = (base / user_path).resolve()
        # Ensure target is within base
        target.relative_to(base)
        return target
    except (ValueError, RuntimeError):
        return None


def iso_now() -> str:
    """Return current time as ISO 8601 string."""
    return datetime.now().isoformat()
