#!/usr/bin/env python3
"""
LLM Wiki Agent -- Backend Startup Script with Health Checks

Usage:
    python start_backend.py              # start backend with default checks
    python start_backend.py --port 8000  # custom port
    python start_backend.py --skip-checks # skip pre-flight dependency checks
    python start_backend.py --no-infer    # do not run post-startup API checks

This script performs pre-flight checks, starts the uvicorn backend,
and optionally runs a post-startup feature status verification.
"""
from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO = Path(__file__).parent
DEFAULT_PORT = 8000
DEFAULT_HOST = "127.0.0.1"

# -- Terminal colours --
_C = True
if sys.platform == "win32":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass
    try:
        import colorama
        colorama.init()
    except Exception:
        pass


def _c(code: str, text: str) -> str:
    if not _C:
        return text
    codes = {
        "ok": "\033[92m",      # green
        "warn": "\033[93m",    # yellow
        "err": "\033[91m",     # red
        "info": "\033[94m",    # blue
        "bold": "\033[1m",
        "reset": "\033[0m",
    }
    return f"{codes.get(code, '')}{text}{codes['reset']}"


def ok(text: str) -> str:
    return _c("ok", f"[OK] {text}")


def warn(text: str) -> str:
    return _c("warn", f"[WARN] {text}")


def err(text: str) -> str:
    return _c("err", f"[ERR] {text}")


def info(text: str) -> str:
    return _c("info", f"[INFO] {text}")


# -- Helpers --

def is_port_free(port: int, host: str = DEFAULT_HOST) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def wait_for_port(port: int, timeout: float = 15.0, host: str = DEFAULT_HOST) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.3)
            try:
                sock.connect((host, port))
                return True
            except OSError:
                time.sleep(0.2)
    return False


def http_get_json(path: str, port: int, host: str = DEFAULT_HOST, timeout: float = 5.0) -> dict | None:
    url = f"http://{host}:{port}{path}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def check_module(name: str, attr: str | None = None) -> tuple[bool, str]:
    try:
        mod = __import__(name)
        if attr:
            val = getattr(mod, attr)
            return True, str(val)
        return True, "installed"
    except ImportError:
        return False, "not installed"


# -- Pre-flight checks --

def preflight_checks(skip: bool) -> dict[str, Any]:
    results: dict[str, Any] = {"passed": True, "details": []}
    if skip:
        print(info("Skipping pre-flight dependency checks."))
        return results

    print(_c("bold", "\n+--------------------------------------------------"))
    print(_c("bold", "|     Backend Pre-flight Checks                    |"))
    print(_c("bold", "+--------------------------------------------------+\n"))

    # 1. Python version
    py_major, py_minor = sys.version_info[:2]
    if py_major >= 3 and py_minor >= 10:
        print(ok(f"Python {py_major}.{py_minor}.{sys.version_info[2]}"))
    else:
        print(err(f"Python {py_major}.{py_minor} -- requires >= 3.10"))
        results["passed"] = False

    # 2. Core dependencies
    deps = [
        ("fastapi", "__version__"),
        ("uvicorn", "__version__"),
        ("pydantic", "__version__"),
        ("starlette", "__version__"),
    ]
    for name, attr in deps:
        ok_flag, val = check_module(name, attr)
        if ok_flag:
            print(ok(f"{name:15} {val}"))
        else:
            print(err(f"{name:15} MISSING (pip install {name})"))
            results["passed"] = False

    # 3. Optional but important dependencies
    opt_deps = [
        ("litellm", "__version__", "LLM chat / RAG / ingest will be unavailable"),
        ("markitdown", None, "File conversion (PDF/docx -> md) will be unavailable"),
        ("networkx", "__version__", "Graph build will fail"),
        ("yaml", None, "Config save/load will fail (pip install pyyaml)"),
        ("watchdog", "__version__", "File watcher auto-ingest unavailable"),
    ]
    for name, attr, consequence in opt_deps:
        ok_flag, val = check_module(name, attr)
        if ok_flag:
            print(ok(f"{name:15} {val}"))
        else:
            print(warn(f"{name:15} missing -- {consequence}"))

    # 4. Key files / directories
    print("")
    required = [
        ("tools/api_server.py", True),
        ("wiki/index.md", False),
        ("wiki/sources", False),
        ("wiki/entities", False),
        ("wiki/concepts", False),
        ("config/llm.yaml", False),
    ]
    for rel_path, required_flag in required:
        p = REPO / rel_path
        if p.exists():
            print(ok(f"{'[REQ]' if required_flag else '[OPT]'} {rel_path}"))
        elif required_flag:
            print(err(f"[REQ] {rel_path} NOT FOUND"))
            results["passed"] = False
        else:
            print(warn(f"[OPT] {rel_path} missing"))

    # 5. LLM API key check
    print("")
    api_key = ""
    key_file = REPO / ".cache" / "llm_api_key"
    for env_name in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY"):
        val = __import__("os").environ.get(env_name, "")
        if val:
            api_key = env_name
            break
    if not api_key and key_file.exists():
        try:
            if key_file.read_text(encoding="utf-8").strip():
                api_key = "file:.cache/llm_api_key"
        except Exception:
            pass
    if api_key:
        print(ok(f"LLM API key detected ({api_key})"))
    else:
        print(warn("No LLM API key found -- LLM features will fail"))

    # 6. Port check
    print("")
    return results


# -- Post-startup feature checks --

def post_startup_checks(port: int, host: str = DEFAULT_HOST) -> dict[str, Any]:
    print(_c("bold", "\n+--------------------------------------------------"))
    print(_c("bold", "|     Post-startup Feature Status                  |"))
    print(_c("bold", "+--------------------------------------------------+\n"))

    results: dict[str, Any] = {"all_ok": True, "checks": {}}
    base_url = f"http://{host}:{port}"

    # 1. Basic health
    data = http_get_json("/api/health", port, host)
    if data:
        pages = data.get("pages", 0)
        graph_ready = data.get("graph_ready", False)
        litellm = data.get("litellm_available", False)
        print(ok(f"Health check -- pages={pages}, graph={graph_ready}, litellm={litellm}"))
        results["checks"]["health"] = "ok"
    else:
        print(err("Health check failed -- no response"))
        results["all_ok"] = False
        results["checks"]["health"] = "fail"

    # 2. System status
    data = http_get_json("/api/status", port, host)
    if data:
        wiki = data.get("wiki", {})
        print(ok(f"Status -- sources={wiki.get('sources',0)}, entities={wiki.get('entities',0)}, "
                 f"concepts={wiki.get('concepts',0)}, last_ingest={wiki.get('last_ingest') or 'N/A'}"))
        results["checks"]["status"] = "ok"
    else:
        print(warn("Status endpoint unreachable"))
        results["checks"]["status"] = "fail"

    # 3. Search
    data = http_get_json("/api/search?q=test&limit=1", port, host)
    if data and "results" in data:
        print(ok(f"Search API -- {len(data['results'])} result(s)"))
        results["checks"]["search"] = "ok"
    else:
        print(warn("Search API not responding correctly"))
        results["checks"]["search"] = "fail"

    # 4. FTS5 search
    data = http_get_json("/api/search/fts?q=wiki&limit=1", port, host)
    if data and "results" in data:
        print(ok(f"FTS5 search -- {data.get('count', 0)} result(s)"))
        results["checks"]["fts"] = "ok"
    else:
        print(warn("FTS5 search unavailable (may need initial indexing)"))
        results["checks"]["fts"] = "fail"

    # 5. Graph
    data = http_get_json("/api/graph", port, host)
    if data and "nodes" in data:
        print(ok(f"Graph -- {len(data['nodes'])} nodes, {len(data.get('edges', []))} edges"))
        results["checks"]["graph"] = "ok"
    else:
        print(warn("Graph not built yet (run: python tools/build_graph.py)"))
        results["checks"]["graph"] = "fail"

    # 6. LLM config
    data = http_get_json("/api/llm-config", port, host)
    if data:
        model = data.get("model", "N/A")
        key_set = data.get("api_key_set", False)
        print(ok(f"LLM config -- model={model}, api_key_set={key_set}"))
        results["checks"]["llm_config"] = "ok"
    else:
        print(warn("LLM config endpoint unreachable"))
        results["checks"]["llm_config"] = "fail"

    # 7. Raw files
    data = http_get_json("/api/raw-files", port, host)
    if data and "files" in data:
        total = len(data["files"])
        ingested = sum(1 for f in data["files"] if f.get("ingested"))
        print(ok(f"Raw files -- {total} total, {ingested} ingested"))
        results["checks"]["raw_files"] = "ok"
    else:
        print(warn("Raw files endpoint unreachable"))
        results["checks"]["raw_files"] = "fail"

    # 8. Tools list
    data = http_get_json("/api/tools/list", port, host)
    if data and "tools" in data:
        tools = [t["name"] for t in data["tools"]]
        print(ok(f"Tools -- {', '.join(tools)}"))
        results["checks"]["tools"] = "ok"
    else:
        print(warn("Tools list endpoint unreachable"))
        results["checks"]["tools"] = "fail"

    # Summary
    passed = sum(1 for v in results["checks"].values() if v == "ok")
    total = len(results["checks"])
    print("")
    if passed == total:
        print(_c("ok", f"[OK] All {total} feature checks passed."))
    else:
        print(_c("warn", f"[WARN] {passed}/{total} checks passed. Review warnings above."))
        results["all_ok"] = False

    return results


# -- Main --

def main() -> int:
    parser = argparse.ArgumentParser(description="Start LLM Wiki Agent backend with health checks")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Bind host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Bind port (default: {DEFAULT_PORT})")
    parser.add_argument("--skip-checks", action="store_true", help="Skip pre-flight dependency checks")
    parser.add_argument("--no-infer", action="store_true", help="Skip post-startup API feature checks")
    parser.add_argument("--no-reload", action="store_true", help="Disable uvicorn auto-reload")
    parser.add_argument("--workers", type=int, default=1, help="Uvicorn workers (default: 1)")
    parser.add_argument("--auto-port", action="store_true", help="Automatically find a free port if occupied")
    args = parser.parse_args()

    port = args.port

    # Pre-flight
    pre = preflight_checks(args.skip_checks)
    if not pre["passed"]:
        print("")
        print(err("Pre-flight checks FAILED. Fix issues above or use --skip-checks to bypass."))
        return 1

    # Port availability
    print(info(f"Checking port {port}..."))
    if not is_port_free(port):
        if args.auto_port:
            for p in range(port + 1, 65536):
                if is_port_free(p):
                    print(warn(f"Port {port} in use. Switching to {p}."))
                    port = p
                    break
            else:
                print(err("No free port found."))
                return 1
        else:
            print(err(f"Port {port} is already in use. Use --auto-port or --port <other>."))
            return 1
    print(ok(f"Port {port} is available."))

    # Build uvicorn command
    cmd = [
        sys.executable, "-m", "uvicorn",
        "tools.api_server:app",
        "--host", args.host,
        "--port", str(port),
    ]
    if not args.no_reload and (REPO / "tools" / "api_server.py").exists():
        cmd.append("--reload")
    if args.workers > 1:
        cmd.extend(["--workers", str(args.workers)])

    print("")
    print(_c("bold", f"Starting backend: {' '.join(cmd)}"))
    print("")

    kwargs: dict = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(cmd, cwd=str(REPO), **kwargs)
    print(info(f"Backend PID: {proc.pid}"))

    # Wait for startup
    print(info("Waiting for backend to accept connections..."), end="", flush=True)
    if wait_for_port(port, timeout=20.0, host=args.host):
        print(ok(" READY"))
    else:
        print(err(" TIMEOUT"))
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        return 1

    # Post-startup checks
    if not args.no_infer:
        post_startup_checks(port, args.host)

    # Final banner
    print("")
    print(_c("bold", "+--------------------------------------------------+"))
    print(_c("bold", f"|  Backend running at http://{args.host}:{port:<15}|"))
    print(_c("bold", "+--------------------------------------------------+"))
    print("")
    print("Press Ctrl+C to stop.\n")

    # Keep main process alive and monitor child
    try:
        while True:
            time.sleep(1)
            if proc.poll() is not None:
                print(err(f"Backend exited unexpectedly (code: {proc.returncode})."))
                return proc.returncode or 1
    except KeyboardInterrupt:
        print("\n" + info("Stopping backend..."))
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        print(ok("Backend stopped."))
        return 0


if __name__ == "__main__":
    sys.exit(main())
