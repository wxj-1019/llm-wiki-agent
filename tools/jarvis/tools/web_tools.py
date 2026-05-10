#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
import uuid
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

REPO_ROOT = Path(__file__).parent.parent.parent.parent

from tools.jarvis.tool_registry import register_tool
from tools.jarvis.types import RiskLevel

_HAS_TRAFILATURA = False
try:
    import trafilatura
    _HAS_TRAFILATURA = True
except ImportError:
    pass


@register_tool(
    name="web_search",
    description="Search the web using DuckDuckGo",
    risk_level=RiskLevel.L0,
    input_schema={"query": {"type": "str"}, "max_results": {"type": "int", "default": 10}},
    output_schema={"results": {"type": "list"}},
    category="web",
)
def web_search(query: str, max_results: int = 10) -> dict:
    results = []
    try:
        url = f"https://html.duckduckgo.com/html/?q={quote(query)}"
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Jarvis/1.0)"})
        with urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        blocks = re.findall(r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
        snippets = re.findall(r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        for i, (href, title) in enumerate(blocks[:max_results]):
            clean_title = re.sub(r'<[^>]+>', '', title).strip()
            snippet = ""
            if i < len(snippets):
                snippet = re.sub(r'<[^>]+>', '', snippets[i]).strip()
            results.append({"title": clean_title, "url": href, "snippet": snippet})
    except Exception as e:
        return {"success": False, "error": str(e), "results": []}
    return {"success": True, "results": results, "count": len(results)}


@register_tool(
    name="web_fetch",
    description="Fetch a web page and optionally extract text content",
    risk_level=RiskLevel.L1,
    input_schema={"url": {"type": "str"}, "timeout": {"type": "int", "default": 30}, "extract_text": {"type": "bool", "default": True}},
    output_schema={"content": {"type": "str"}, "status_code": {"type": "int"}},
    category="web",
)
def web_fetch(url: str, timeout: int = 30, extract_text: bool = True) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"success": False, "error": f"Unsupported scheme: {parsed.scheme}"}
    try:
        req = Request(url, headers={"User-Agent": "Jarvis/1.0"})
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            content_type = resp.headers.get("Content-Type", "")
            status_code = resp.status
    except HTTPError as e:
        return {"success": False, "error": str(e), "status_code": e.code}
    except URLError as e:
        return {"success": False, "error": str(e)}
    content = raw
    if extract_text and _HAS_TRAFILATURA:
        text = trafilatura.extract(raw)
        if text:
            content = text
    elif extract_text:
        text = raw.decode("utf-8", errors="replace")
        content = re.sub(r'<[^>]+>', ' ', text)
        content = re.sub(r'\s+', ' ', content).strip()
    else:
        content = raw.decode("utf-8", errors="replace")
    return {
        "success": True,
        "content": content[:50000],
        "status_code": status_code,
        "content_type": content_type,
        "size": len(raw),
    }


@register_tool(
    name="api_call",
    description="Make an HTTP API call to an external service",
    risk_level=RiskLevel.L2,
    input_schema={"url": {"type": "str"}, "method": {"type": "str", "default": "GET"}, "headers": {"type": "dict"}, "body": {"type": "str"}, "timeout": {"type": "int", "default": 30}},
    output_schema={"status_code": {"type": "int"}, "body": {"type": "str"}},
    category="web",
)
def api_call(url: str, method: str = "GET", headers: dict = None, body: str = "", timeout: int = 30) -> dict:
    headers = headers or {}
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"success": False, "error": f"Blocked scheme: {parsed.scheme}"}
    start = time.perf_counter()
    try:
        data = body.encode("utf-8") if body else None
        req = Request(url, data=data, headers=headers, method=method.upper())
        with urlopen(req, timeout=timeout) as resp:
            resp_body = resp.read().decode("utf-8", errors="replace")
            resp_headers = dict(resp.headers)
            duration_ms = (time.perf_counter() - start) * 1000
            return {
                "success": True,
                "status_code": resp.status,
                "headers": resp_headers,
                "body": resp_body[:50000],
                "duration_ms": round(duration_ms, 1),
            }
    except HTTPError as e:
        resp_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return {"success": False, "status_code": e.code, "body": resp_body[:50000]}
    except Exception as e:
        return {"success": False, "error": str(e)}


@register_tool(
    name="webhook_send",
    description="Send a webhook notification with JSON payload",
    risk_level=RiskLevel.L2,
    input_schema={"url": {"type": "str"}, "payload": {"type": "dict"}, "method": {"type": "str", "default": "POST"}, "headers": {"type": "dict"}},
    output_schema={"status_code": {"type": "int"}, "response": {"type": "str"}},
    category="web",
)
def webhook_send(url: str, payload: dict, method: str = "POST", headers: dict = None) -> dict:
    headers = headers or {}
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"success": False, "error": f"Blocked scheme: {parsed.scheme}"}
    try:
        data = json.dumps(payload).encode("utf-8")
        hdrs = {"Content-Type": "application/json"}
        hdrs.update(headers)
        req = Request(url, data=data, headers=hdrs, method=method.upper())
        with urlopen(req, timeout=15) as resp:
            resp_body = resp.read().decode("utf-8", errors="replace")
            return {"success": True, "status_code": resp.status, "response": resp_body[:10000]}
    except HTTPError as e:
        return {"success": False, "status_code": e.code, "response": ""}
    except Exception as e:
        return {"success": False, "error": str(e)}


@register_tool(
    name="download",
    description="Download a file from the internet to raw/ directory",
    risk_level=RiskLevel.L1,
    input_schema={"url": {"type": "str"}, "save_path": {"type": "str", "default": ""}, "timeout": {"type": "int", "default": 120}},
    output_schema={"path": {"type": "str"}, "size": {"type": "int"}},
    category="web",
)
def download(url: str, save_path: str = "", timeout: int = 120) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"success": False, "error": f"Blocked scheme: {parsed.scheme}"}
    filename = Path(parsed.path).name or f"download_{uuid.uuid4().hex[:8]}"
    if not save_path:
        save_path = str(REPO_ROOT / "raw" / filename)
    target = Path(save_path)
    if ".." in target.parts:
        return {"success": False, "error": "Path traversal detected"}
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = Request(url, headers={"User-Agent": "Jarvis/1.0"})
        with urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            target.write_bytes(data)
        return {"success": True, "path": str(target), "size": len(data), "filename": filename}
    except Exception as e:
        return {"success": False, "error": str(e)}


@register_tool(
    name="url_check",
    description="Check if a URL is reachable using a HEAD request",
    risk_level=RiskLevel.L0,
    input_schema={"url": {"type": "str"}, "timeout": {"type": "int", "default": 10}},
    output_schema={"reachable": {"type": "bool"}, "status_code": {"type": "int"}},
    category="web",
)
def url_check(url: str, timeout: int = 10) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"reachable": False, "error": f"Blocked scheme: {parsed.scheme}"}
    start = time.perf_counter()
    try:
        req = Request(url, headers={"User-Agent": "Jarvis/1.0"}, method="HEAD")
        with urlopen(req, timeout=timeout) as resp:
            duration_ms = (time.perf_counter() - start) * 1000
            return {"reachable": True, "status_code": resp.status, "response_time_ms": round(duration_ms, 1)}
    except HTTPError as e:
        duration_ms = (time.perf_counter() - start) * 1000
        return {"reachable": True, "status_code": e.code, "response_time_ms": round(duration_ms, 1)}
    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000
        return {"reachable": False, "error": str(e), "response_time_ms": round(duration_ms, 1)}


def register_all():
    pass
