#!/usr/bin/env python3
"""API smoke tests — verify key endpoints without external deps.

Usage:
    python tools/test_api.py

Requires: fastapi, uvicorn, httpx (or stdlib urllib)
"""
from __future__ import annotations

import sys
import urllib.request
import urllib.error
import json
from pathlib import Path

REPO = Path(__file__).parent.parent
BASE = "http://127.0.0.1:8000"


def _get(path: str) -> dict:
    req = urllib.request.Request(f"{BASE}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return {"status": resp.status, "body": resp.read().decode()}


def _post(path: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"status": resp.status, "body": resp.read().decode()}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read().decode()}


def run_tests() -> int:
    passed = 0
    failed = 0

    tests = [
        ("GET /api/graph", lambda: _get("/api/graph")),
        ("GET /api/search/fts?q=transformer", lambda: _get("/api/search/fts?q=transformer")),
        ("GET /api/index-etag", lambda: _get("/api/index-etag")),
        ("GET /api/status", lambda: _get("/api/status")),
        ("POST /api/wiki/write", lambda: _post("/api/wiki/write", {"path": "wiki/test-api-write.md", "content": "# Test\n\nHello.\n"})),
        ("POST /api/webhook/github (no event)", lambda: _post("/api/webhook/github", {})),
    ]

    for name, fn in tests:
        try:
            result = fn()
            ok = result["status"] in (200, 400, 401)
            if ok:
                print(f"  [PASS] {name} — {result['status']}")
                passed += 1
            else:
                print(f"  [FAIL] {name} — {result['status']}: {result['body'][:100]}")
                failed += 1
        except urllib.error.URLError as e:
            print(f"  [SKIP] {name} — API server not running ({e})")
        except Exception as e:
            print(f"  [FAIL] {name} — {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_tests())
