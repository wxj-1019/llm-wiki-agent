#!/usr/bin/env python3
from __future__ import annotations

"""Lightweight API server for LLM Wiki Agent."""

import json
import os
import re
import sys
import time
import subprocess
from pathlib import Path
from collections import defaultdict
from datetime import datetime

try:
    import yaml
except ImportError:
    yaml = None
from fastapi import FastAPI, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi import HTTPException
from pydantic import BaseModel, Field

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
GRAPH = REPO / "graph"
FRONTEND_DIST = REPO / "wiki-viewer" / "dist"

ALLOWED_EXTENSIONS = {
    ".md", ".txt", ".pdf", ".docx", ".pptx", ".xlsx", ".xls",
    ".html", ".htm", ".csv", ".json", ".xml",
    ".rst", ".rtf", ".epub", ".ipynb",
    ".yaml", ".yml", ".tsv",
}
MAX_UPLOAD_SIZE = 20 * 1024 * 1024

app = FastAPI(title="LLM Wiki API")

# ── Request logging middleware ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    client = request.client.host if request.client else "-"
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {client} {request.method} {request.url.path} {response.status_code} {duration:.1f}ms")
    return response

# ── Simple in-memory rate limiter ──
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 60  # requests per window
RATE_LIMIT_WINDOW = 60  # seconds

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    client = request.client.host if request.client else "unknown"
    now = time.time()
    window = _rate_limit_store[client]
    # Prune old entries
    _rate_limit_store[client] = [t for t in window if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client]) >= RATE_LIMIT_MAX:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded. Please slow down."})
    _rate_limit_store[client].append(now)
    return await call_next(request)

# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[ERROR] Unhandled exception at {request.url.path}: {exc}", file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc) if os.getenv("DEBUG") else "Please check server logs."},
    )

# Restrict CORS to localhost for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

@app.get("/api/graph")
def get_graph():
    graph_path = GRAPH / "graph.json"
    if not graph_path.exists():
        return {"error": "Graph not found"}
    try:
        data = graph_path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        data = graph_path.read_text(encoding="utf-8", errors="replace")
    return json.loads(data)

@app.get("/api/pages/{page_type}/{slug}")
def get_page(page_type: str, slug: str):
    # Whitelist allowed page types to prevent path traversal
    allowed_types = {"sources", "entities", "concepts", "syntheses"}
    if page_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid page type")
    # Sanitize slug
    safe_slug = Path(slug).name
    if not safe_slug or safe_slug in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid slug")
    path = WIKI / page_type / f"{safe_slug}.md"
    # Ensure resolved path stays within wiki
    try:
        path.resolve().relative_to(WIKI.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return {"markdown": path.read_text(encoding="utf-8"), "path": str(path)}

@app.get("/api/index")
def get_index():
    path = WIKI / "index.md"
    if not path.exists():
        return {"markdown": ""}
    return {"markdown": path.read_text(encoding="utf-8")}

@app.get("/api/log")
def get_log():
    path = WIKI / "log.md"
    if not path.exists():
        return {"markdown": ""}
    return {"markdown": path.read_text(encoding="utf-8")}

@app.get("/api/overview")
def get_overview():
    path = WIKI / "overview.md"
    if not path.exists():
        return {"markdown": ""}
    return {"markdown": path.read_text(encoding="utf-8")}

@app.get("/api/search")
def search(q: str = Query("", min_length=1)):
    if not q or len(q.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required and must be non-empty")
    q_clean = q.strip().lower()
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
            continue
        content = p.read_text(encoding="utf-8")
        if q_clean in content.lower():
            results.append({
                "id": p.relative_to(WIKI).as_posix().replace(".md", ""),
                "path": str(p.relative_to(REPO)),
                "preview": content[:200],
            })
    return {"results": results, "total": len(results)}

@app.get("/api/health")
def health():
    pages = list(WIKI.rglob("*.md"))
    graph_exists = (GRAPH / "graph.json").exists()
    return {
        "pages": len(pages),
        "graph_ready": graph_exists,
        "wiki_dir": str(WIKI),
    }


@app.get("/api/config/llm")
def get_llm_config_legacy():
    cfg = _load_llm_config()
    model = cfg.get("model") or os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest")
    model_fast = cfg.get("model_fast") or os.getenv("LLM_MODEL_FAST", "claude-3-5-haiku-latest")
    provider = cfg.get("provider", "anthropic")
    return {
        "model": model,
        "model_fast": model_fast,
        "provider": provider,
        "api_key_set": bool(cfg.get("api_key")),
    }


@app.get("/api/status")
def get_system_status():
    """Return comprehensive system status for the dashboard."""
    import time
    pages = list(WIKI.rglob("*.md"))
    graph_exists = (GRAPH / "graph.json").exists()
    raw_dir = REPO / "raw"
    raw_files = [p for p in raw_dir.rglob("*") if p.is_file() and p.name != ".gitkeep"]
    agent_kit_dir = REPO / "agent-kit"
    agent_kit_files = [p for p in agent_kit_dir.rglob("*") if p.is_file()] if agent_kit_dir.exists() else []

    # Parse last ingest from log
    last_ingest = None
    log_path = WIKI / "log.md"
    if log_path.exists():
        try:
            log_content = log_path.read_text(encoding="utf-8")
            for line in reversed(log_content.splitlines()):
                if line.startswith("## [") and "ingest" in line.lower():
                    match = re.search(r"\[(\d{4}-\d{2}-\d{2})\]", line)
                    if match:
                        last_ingest = match.group(1)
                        break
        except Exception:
            pass

    cfg = _load_llm_config()
    return {
        "wiki": {
            "pages": len(pages),
            "sources": len([p for p in pages if p.parent.name == "sources"]),
            "entities": len([p for p in pages if p.parent.name == "entities"]),
            "concepts": len([p for p in pages if p.parent.name == "concepts"]),
            "syntheses": len([p for p in pages if p.parent.name == "syntheses"]),
            "last_ingest": last_ingest,
        },
        "graph": {
            "ready": graph_exists,
            "path": str(GRAPH / "graph.json") if graph_exists else None,
        },
        "raw": {
            "files": len(raw_files),
        },
        "agent_kit": {
            "generated": bool(agent_kit_files),
            "files": len(agent_kit_files),
        },
        "llm": {
            "provider": cfg.get("provider", "anthropic"),
            "model": cfg.get("model") or os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest"),
            "api_key_set": bool(cfg.get("api_key")),
        },
        "server": {
            "time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "version": "1.0.0",
        },
    }


@app.get("/api/raw-files")
def list_raw_files():
    raw_dir = REPO / "raw"
    files = []
    for p in raw_dir.rglob("*"):
        if p.is_file() and p.name != ".gitkeep":
            files.append({
                "path": p.relative_to(REPO).as_posix(),
                "name": p.name,
                "size": p.stat().st_size,
                "modified": p.stat().st_mtime,
            })
    files.sort(key=lambda x: x["modified"], reverse=True)
    return {"files": files}


@app.get("/api/raw-file-content")
def get_raw_file_content(path: str = Query(..., min_length=1)):
    """Return the text content of a raw file for preview."""
    if not path:
        raise HTTPException(status_code=400, detail="path is required")
    target = (REPO / path).resolve()
    raw_dir = (REPO / "raw").resolve()
    try:
        target.relative_to(raw_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path must be within raw/")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Not a file")
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not text-readable")
    return {"content": content}


@app.post("/api/upload/file")
async def upload_file(file: UploadFile = File(...)):
    safe_name = Path(file.filename or "unnamed").name
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    suffix = Path(safe_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    uploads_dir = REPO / "raw" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    target = uploads_dir / safe_name
    counter = 1
    stem = target.stem
    orig_suffix = target.suffix
    while target.exists():
        target = uploads_dir / f"{stem}_{counter}{orig_suffix}"
        counter += 1

    # Stream read with early size check to avoid loading huge files into memory
    content = b""
    while True:
        chunk = await file.read(1024 * 1024)  # 1 MB chunks
        if not chunk:
            break
        content += chunk
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    target.write_bytes(content)

    # Try markitdown conversion for non-text files
    converted = None
    if suffix.lower() not in (".md", ".txt"):
        try:
            from markitdown import MarkItDown
            md = MarkItDown(enable_plugins=False)
            result = md.convert(str(target))
            converted_path = target.with_suffix(".md")
            converted_path.write_text(result.text_content, encoding="utf-8")
            converted = converted_path.relative_to(REPO).as_posix()
        except Exception:
            pass

    return {
        "success": True,
        "path": target.relative_to(REPO).as_posix(),
        "converted_path": converted,
        "size": len(content),
    }


@app.post("/api/upload/text")
async def upload_text(payload: UploadTextPayload):
    title = payload.title.strip()
    content = payload.content
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    safe_title = re.sub(r'[\\/*?:"<>|]', "_", title)
    if not safe_title.endswith(".md"):
        safe_title += ".md"

    uploads_dir = REPO / "raw" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    target = uploads_dir / safe_title

    counter = 1
    stem = target.stem
    suffix = target.suffix
    while target.exists():
        target = uploads_dir / f"{stem}_{counter}{suffix}"
        counter += 1

    target.write_text(content, encoding="utf-8")

    return {
        "success": True,
        "path": target.relative_to(REPO).as_posix(),
    }


@app.delete("/api/raw-files/{path:path}")
def delete_raw_file(path: str):
    """Delete a file from raw/uploads directory. Returns 400 if path escapes raw/."""
    raw_dir = (REPO / "raw").resolve()
    target = (REPO / path).resolve()
    try:
        target.relative_to(raw_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path must be within raw/")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Not a file")
    try:
        target.unlink()
        return {"success": True, "path": str(target.relative_to(REPO))}
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


@app.post("/api/ingest")
async def api_ingest(payload: IngestPayload):
    path_str = payload.path
    if not path_str:
        raise HTTPException(status_code=400, detail="path is required")

    target = (REPO / path_str).resolve()
    raw_dir = (REPO / "raw").resolve()
    try:
        target.relative_to(raw_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path must be within raw/")

    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        result = subprocess.run(
            [sys.executable, str(REPO / "tools" / "ingest.py"), str(target)],
            capture_output=True,
            text=True,
            cwd=str(REPO),
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Ingest timed out after 5 minutes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")


@app.get("/api/config/{name}")
def get_config(name: str):
    safe_name = Path(name).name
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid config name")
    path = REPO / "config" / f"{safe_name}.yaml"
    if not path.exists():
        path = REPO / "config" / f"{safe_name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Config not found")
    try:
        path.resolve().relative_to((REPO / "config").resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    return {"name": safe_name, "content": path.read_text(encoding="utf-8")}


@app.post("/api/config/{name}")
async def save_config(name: str, request: Request):
    safe_name = Path(name).name
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid config name")
    path = REPO / "config" / f"{safe_name}.yaml"
    try:
        path.resolve().relative_to((REPO / "config").resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    path.parent.mkdir(parents=True, exist_ok=True)
    body = await request.body()
    path.write_text(body.decode("utf-8"), encoding="utf-8")
    return {"ok": True, "path": str(path)}


# ── Agent Kit ──
AGENT_KIT_DIR = REPO / "agent-kit"
AGENT_KIT_STATE = REPO / ".cache" / "agent-kit-state.json"


@app.get("/api/agent-kit/status")
def agent_kit_status():
    """Return generation status and last run info."""
    status = {"generated": False, "last_run": None, "outputs": []}
    if AGENT_KIT_STATE.exists():
        try:
            states = json.loads(AGENT_KIT_STATE.read_text(encoding="utf-8"))
            if isinstance(states, list) and states:
                last = states[-1]
                status["generated"] = True
                status["last_run"] = last.get("timestamp")
                status["outputs"] = last.get("outputs", [])
        except (json.JSONDecodeError, OSError):
            pass
    # Also list current files on disk
    files = []
    if AGENT_KIT_DIR.exists():
        for p in AGENT_KIT_DIR.rglob("*"):
            if p.is_file():
                files.append(p.relative_to(AGENT_KIT_DIR).as_posix())
    status["files"] = files
    return status


@app.post("/api/agent-kit/generate")
async def agent_kit_generate(payload: AgentKitGeneratePayload):
    """Run export_agent_kit.py with specified options."""
    cmd = [sys.executable, str(REPO / "tools" / "export_agent_kit.py"), "--target", payload.target]
    if payload.package:
        cmd.append("--package")
    if payload.incremental:
        cmd.append("--incremental")
    if payload.skipDiagrams:
        cmd.append("--skip-diagrams")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(REPO),
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Generation timed out after 5 minutes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@app.get("/api/agent-kit/files")
def agent_kit_files(path: str = Query(""), recursive: bool = Query(False)):
    """List files and directories under agent-kit/."""
    base = AGENT_KIT_DIR.resolve()
    target = (base / path).resolve() if path else base
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.exists():
        raise HTTPException(status_code=404, detail="Not found")

    if target.is_file():
        return {
            "files": [{
                "name": target.name,
                "path": target.relative_to(base).as_posix(),
                "size": target.stat().st_size,
                "is_dir": False,
            }],
            "stats": {"total_files": 1, "total_size": target.stat().st_size},
        }

    if recursive:
        items = []
        total_files = 0
        total_size = 0
        for p in target.rglob("*"):
            if p.is_file():
                items.append({
                    "name": p.name,
                    "path": p.relative_to(base).as_posix(),
                    "size": p.stat().st_size,
                    "is_dir": False,
                })
                total_files += 1
                total_size += p.stat().st_size
        return {
            "files": items,
            "stats": {"total_files": total_files, "total_size": total_size},
        }

    items = []
    for p in sorted(target.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        items.append({
            "name": p.name,
            "path": p.relative_to(base).as_posix(),
            "size": p.stat().st_size if p.is_file() else 0,
            "is_dir": p.is_dir(),
        })
    return {"files": items, "stats": None}


@app.get("/api/agent-kit/download")
def agent_kit_download(path: str = Query(..., min_length=1)):
    """Download a single file from agent-kit/."""
    base = AGENT_KIT_DIR.resolve()
    target = (base / path).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(target), filename=target.name)


@app.post("/api/agent-kit/download-zip")
async def agent_kit_download_zip(payload: DownloadZipPayload):
    """Download selected files as a zip archive."""
    import zipfile
    import io

    paths = payload.paths
    if not paths:
        raise HTTPException(status_code=400, detail="No paths provided")

    base = AGENT_KIT_DIR.resolve()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel_path in paths:
            target = (base / rel_path).resolve()
            try:
                target.relative_to(base)
            except ValueError:
                continue
            if target.exists() and target.is_file():
                zf.write(target, target.relative_to(base).as_posix())

    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=agent-kit.zip"})


LLM_CONFIG_PATH = REPO / "config" / "llm.yaml"


def _load_llm_config() -> dict:
    """Load LLM config from config/llm.yaml and apply env overrides."""
    if not yaml or not LLM_CONFIG_PATH.exists():
        return {}
    try:
        cfg = yaml.safe_load(LLM_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}
    # Apply to environment so all tools/scripts pick it up
    if cfg.get("model"):
        os.environ.setdefault("LLM_MODEL", cfg["model"])
    if cfg.get("model_fast"):
        os.environ.setdefault("LLM_MODEL_FAST", cfg["model_fast"])
    # Set provider API key env var if present
    provider = cfg.get("provider", "anthropic")
    api_key = cfg.get("api_key", "")
    if api_key:
        key_env = f"{provider.upper().replace('-', '_')}_API_KEY"
        os.environ[key_env] = api_key
    return cfg


@app.post("/api/agent-kit/llm-chat")
async def agent_kit_llm_chat(request: Request):
    """Chat with LLM for agent-kit assistance (Skill / MCP generation, review, etc.)."""
    try:
        from litellm import completion
    except ImportError:
        raise HTTPException(status_code=500, detail="litellm not installed. Run: pip install litellm")

    body = await request.json()
    messages = body.get("messages", [])
    system_prompt = body.get("system_prompt", "")

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    cfg = _load_llm_config()
    model = cfg.get("model") or os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    kwargs: dict = {"model": model, "messages": full_messages, "max_tokens": 4096}
    if api_key:
        kwargs["api_key"] = api_key
    try:
        response = completion(**kwargs)
        content = response.choices[0].message.content
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")


@app.post("/api/agent-kit/llm-chat-stream")
async def agent_kit_llm_chat_stream(request: Request):
    """Stream LLM chat responses via SSE for agent-kit assistance."""
    try:
        from litellm import acompletion
    except ImportError:
        raise HTTPException(status_code=500, detail="litellm not installed. Run: pip install litellm")

    body = await request.json()
    messages = body.get("messages", [])
    system_prompt = body.get("system_prompt", "")

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    cfg = _load_llm_config()
    model = cfg.get("model") or os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    kwargs: dict = {"model": model, "messages": full_messages, "max_tokens": 4096, "stream": True}
    if api_key:
        kwargs["api_key"] = api_key

    async def event_generator():
        try:
            response = await acompletion(**kwargs)
            async for chunk in response:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'chunk': delta}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Knowledge-based generation ──

MAX_WIKI_CHARS_PER_PAGE = 3000
MAX_SOURCES = 5


def _search_wiki(query: str, max_results: int = MAX_SOURCES) -> list[dict]:
    """Search wiki pages by keyword relevance. Supports multi-word queries."""
    q_lower = query.strip().lower()
    if not q_lower:
        return []
    # Split query into individual words (min length 2) for OR-style matching
    q_words = [w for w in q_lower.split() if len(w) >= 2]
    if not q_words:
        q_words = [q_lower]
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        text_lower = content.lower()
        # Simple relevance: sum occurrences of each query word
        score = 0
        for w in q_words:
            score += text_lower.count(w)
        # Also check title match
        title = p.stem.replace("-", " ").replace("_", " ").lower()
        for w in q_words:
            if w in title:
                score += 20
        if score > 0:
            results.append({"path": str(p.relative_to(REPO)), "wiki_path": str(p.relative_to(WIKI)), "score": score, "content": content})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:max_results]


def _extract_relevant_snippets(content: str, query: str, max_chars: int = MAX_WIKI_CHARS_PER_PAGE) -> str:
    """Extract most relevant parts of a wiki page for the query."""
    # If content is short enough, return it all
    if len(content) <= max_chars:
        return content
    # Otherwise try to find sections containing query keywords
    q_words = [w for w in query.lower().split() if len(w) > 2]
    lines = content.splitlines()
    scored_lines = []
    for i, line in enumerate(lines):
        score = 0
        line_lower = line.lower()
        for w in q_words:
            score += line_lower.count(w)
        scored_lines.append((i, score))
    scored_lines.sort(key=lambda x: x[1], reverse=True)
    # Take top-scoring lines and surrounding context
    top_indices = sorted({i for i, _ in scored_lines[:15]})
    if not top_indices:
        return content[:max_chars]
    # Build snippet around top indices
    snippet_lines = []
    included = set()
    for idx in top_indices:
        for offset in range(-2, 3):
            i2 = idx + offset
            if 0 <= i2 < len(lines) and i2 not in included:
                included.add(i2)
                snippet_lines.append((i2, lines[i2]))
    snippet_lines.sort(key=lambda x: x[0])
    snippet = "\n".join(line for _, line in snippet_lines)
    if len(snippet) > max_chars:
        snippet = snippet[:max_chars] + "\n... [truncated]"
    return snippet


@app.post("/api/agent-kit/generate-from-knowledge")
async def agent_kit_generate_from_knowledge(request: Request):
    """Generate MCP Server or Skill code based on wiki knowledge retrieved from a user query."""
    try:
        from litellm import completion
    except ImportError:
        raise HTTPException(status_code=500, detail="litellm not installed. Run: pip install litellm")

    body = await request.json()
    query = body.get("query", "").strip()
    target = body.get("target", "skill")  # "mcp" or "skill"
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    if target not in ("mcp", "skill"):
        raise HTTPException(status_code=400, detail="target must be 'mcp' or 'skill'")

    # 1. Search wiki for relevant pages
    search_results = _search_wiki(query)
    if not search_results:
        return {
            "sources": [],
            "code": "",
            "explanation": f"No relevant wiki pages found for query: '{query}'. Try ingesting some documents first, or rephrase your query.",
            "target": target,
        }

    # 2. Extract relevant snippets
    sources = []
    knowledge_chunks = []
    for r in search_results:
        snippet = _extract_relevant_snippets(r["content"], query)
        sources.append({"path": r["wiki_path"], "preview": snippet[:200]})
        knowledge_chunks.append(f"--- Source: {r['wiki_path']} ---\n{snippet}\n")

    knowledge_context = "\n".join(knowledge_chunks)

    # 3. Build generation prompt
    if target == "mcp":
        system_prompt = (
            "You are an expert MCP (Model Context Protocol) server developer. "
            "Given the user's request and the retrieved wiki knowledge below, "
            "generate a complete, production-ready Python MCP server. "
            "Use FastMCP or the stdio-based MCP SDK. Include proper typing, docstrings, and error handling. "
            "The server should expose tools and/or resources that surface the wiki knowledge. "
            "Return ONLY the Python code wrapped in a single markdown code block (```python ... ```), "
            "followed by a brief explanation of the tools/resources provided."
        )
    else:
        system_prompt = (
            "You are an expert in designing LLM Skills (Kimi Skills / Agent Skills). "
            "Given the user's request and the retrieved wiki knowledge below, "
            "generate a complete SKILL.md file and any supporting files. "
            "The skill should help an AI agent leverage the wiki knowledge effectively. "
            "Include: description, usage instructions, example prompts, and workflow guidance. "
            "Return the SKILL.md content wrapped in a markdown code block (```markdown ... ```), "
            "followed by a brief explanation of how the skill works."
        )

    user_prompt = (
        f"User Request: {query}\n\n"
        f"Retrieved Wiki Knowledge:\n{knowledge_context}\n\n"
        f"Please generate a complete {target.upper()} implementation based on the above knowledge."
    )

    cfg = _load_llm_config()
    model = cfg.get("model") or os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    kwargs: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 4096,
    }
    if api_key:
        kwargs["api_key"] = api_key

    try:
        response = completion(**kwargs)
        raw_content = response.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    # Parse code block and explanation
    code = ""
    explanation = ""
    # Try to extract code block
    code_match = re.search(r"```(?:\w+)?\n(.*?)\n```", raw_content, re.DOTALL)
    if code_match:
        code = code_match.group(1).strip()
        explanation = raw_content[code_match.end():].strip()
    else:
        code = raw_content.strip()

    return {
        "sources": sources,
        "code": code,
        "explanation": explanation,
        "target": target,
        "query": query,
    }


@app.get("/api/agent-kit/read-file")
def agent_kit_read_file(path: str = Query(..., min_length=1)):
    """Read a text file from agent-kit/."""
    base = AGENT_KIT_DIR.resolve()
    target = (base / path).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Not a file")
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not text-readable")
    return {"content": content, "path": path}


@app.post("/api/agent-kit/save-file")
async def agent_kit_save_file(request: Request):
    """Save a file into agent-kit/."""
    body = await request.json()
    path_str = body.get("path", "")
    content = body.get("content", "")
    if not path_str:
        raise HTTPException(status_code=400, detail="path is required")

    base = AGENT_KIT_DIR.resolve()
    target = (base / path_str).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return {"success": True, "path": path_str}


@app.get("/api/llm-config")
def get_llm_config():
    """Return LLM config (api_key is never exposed)."""
    if not yaml or not LLM_CONFIG_PATH.exists():
        return {"model": os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest"), "model_fast": os.getenv("LLM_MODEL_FAST", "claude-3-5-haiku-latest"), "provider": "anthropic", "api_key_set": False}
    try:
        cfg = yaml.safe_load(LLM_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except Exception:
        cfg = {}
    provider = cfg.get("provider", "anthropic")
    key_env = f"{provider.upper().replace('-', '_')}_API_KEY"
    return {
        "model": cfg.get("model", os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest")),
        "model_fast": cfg.get("model_fast", os.getenv("LLM_MODEL_FAST", "claude-3-5-haiku-latest")),
        "provider": provider,
        "api_key_set": bool(cfg.get("api_key") or os.getenv(key_env)),
    }


@app.post("/api/llm-config")
async def save_llm_config(payload: LLMConfigPayload):
    """Save LLM config to config/llm.yaml (api_key is stored securely on server)."""
    if not yaml:
        raise HTTPException(status_code=500, detail="PyYAML not installed. Run: pip install pyyaml")
    cfg = {
        "model": payload.model,
        "model_fast": payload.model_fast,
        "provider": payload.provider,
    }
    api_key = payload.api_key
    # Only update api_key if a non-empty value is provided
    if api_key:
        cfg["api_key"] = api_key
    else:
        # Preserve existing api_key if not sent (client doesn't have it)
        if LLM_CONFIG_PATH.exists():
            try:
                existing = yaml.safe_load(LLM_CONFIG_PATH.read_text(encoding="utf-8")) or {}
                if existing.get("api_key"):
                    cfg["api_key"] = existing["api_key"]
            except Exception:
                pass
    LLM_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LLM_CONFIG_PATH.write_text(yaml.safe_dump(cfg, default_flow_style=False, sort_keys=False), encoding="utf-8")
    _load_llm_config()
    return {"ok": True}


# Serve frontend static files if dist exists
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")

# ── Pydantic request models ──
class UploadTextPayload(BaseModel):
    title: str = Field(..., min_length=1, description="Document title")
    content: str = Field(default="", description="Markdown or plain text content")

class IngestPayload(BaseModel):
    path: str = Field(..., min_length=1, description="Path to raw file to ingest")

class AgentKitGeneratePayload(BaseModel):
    target: str = Field(default="all", pattern="^(all|mcp|skill)$")
    package: bool = Field(default=False)
    incremental: bool = Field(default=False)
    skipDiagrams: bool = Field(default=False)

class DownloadZipPayload(BaseModel):
    paths: list[str] = Field(..., min_length=1, description="List of file paths to include in ZIP")

class SaveFilePayload(BaseModel):
    path: str = Field(..., min_length=1)
    content: str = Field(default="")

class LLMConfigPayload(BaseModel):
    model: str = Field(default="claude-3-5-sonnet-latest")
    model_fast: str = Field(default="claude-3-5-haiku-latest")
    provider: str = Field(default="anthropic")
    api_key: str = Field(default="")


# Load LLM config on startup
_load_llm_config()

if __name__ == "__main__":
    import uvicorn
    import argparse
    cli = argparse.ArgumentParser(description="LLM Wiki API Server")
    cli.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    cli.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    cli_args = cli.parse_args()
    uvicorn.run(app, host=cli_args.host, port=cli_args.port)
