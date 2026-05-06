#!/usr/bin/env python3
from __future__ import annotations

"""Lightweight API server for LLM Wiki Agent."""

import asyncio
import hmac
import io
import json
import logging
import os
import re
import sys
import tempfile
import time
import socket
import subprocess
import urllib.parse
from contextlib import asynccontextmanager
from pathlib import Path
from collections import defaultdict
from datetime import datetime

try:
    import yaml
except ImportError:
    yaml = None
from fastapi import FastAPI, Query, Request, UploadFile, File, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi import HTTPException
from pydantic import BaseModel, Field

# MCP & Skill imports
try:
    from mcp_manager import get_mcp_manager
except ImportError:
    get_mcp_manager = None
try:
    from skill_engine import get_skill_engine
except ImportError:
    get_skill_engine = None

# litellm availability check
try:
    import litellm as _litellm_module
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

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
MAX_LLM_MESSAGES = 20
MAX_LLM_CONTENT_SIZE = 50 * 1024  # 50KB
AGENT_DIR = WIKI / ".agent"

# ── Webhook auth (optional) ──
_WEBHOOK_TOKEN = os.environ.get("WIKI_WEBHOOK_TOKEN", "").strip()

async def _require_webhook_token(request: Request) -> None:
    if not _WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Webhook token not configured")
    provided = request.headers.get("X-Webhook-Token", "")
    if not hmac.compare_digest(provided, _WEBHOOK_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid or missing webhook token")

# ── Structured logging setup ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("wiki_api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Shutdown: close search engine connection
    global _search_engine
    if _search_engine:
        _search_engine.close()
        _search_engine = None

app = FastAPI(title="LLM Wiki API", lifespan=lifespan)

# ── Pydantic request models (must be defined before route handlers) ──
class UploadTextPayload(BaseModel):
    title: str = Field(..., min_length=1, description="Document title")
    content: str = Field(default="", description="Markdown or plain text content")

class IngestPayload(BaseModel):
    path: str = Field(..., min_length=1, description="Path to raw file to ingest")

class WebhookClipPayload(BaseModel):
    url: str = Field(..., min_length=1, description="URL to clip and ingest")
    title: str = Field(default="", description="Optional title override")
    tags: list[str] = Field(default_factory=list)

class WebhookIngestPayload(BaseModel):
    path: str = Field(..., min_length=1, description="Path to file within raw/")
    source: str = Field(default="webhook", description="Source identifier")

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
    model: str = Field(default="anthropic/claude-3-5-sonnet-latest")
    model_fast: str = Field(default="anthropic/claude-3-5-haiku-latest")
    provider: str = Field(default="anthropic")
    api_key: str = Field(default="")

# ── Request logging middleware ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    client = request.client.host if request.client else "-"
    logger.info(
        "%s %s %s %.1fms",
        client, request.method, request.url.path, duration,
        extra={"status_code": response.status_code},
    )
    return response

# ── Simple in-memory rate limiter ──
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 60
RATE_LIMIT_WINDOW = 60
_rate_limit_last_cleanup = time.time()
RATE_LIMIT_CLEANUP_INTERVAL = 300

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    global _rate_limit_last_cleanup
    client = request.client.host if request.client else "unknown"
    now = time.time()
    if now - _rate_limit_last_cleanup > RATE_LIMIT_CLEANUP_INTERVAL:
        expired = [k for k, v in _rate_limit_store.items() if not v or all(now - t >= RATE_LIMIT_WINDOW for t in v)]
        for k in expired:
            del _rate_limit_store[k]
        _rate_limit_last_cleanup = now
    window = _rate_limit_store.get(client, [])
    _rate_limit_store[client] = [t for t in window if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client]) >= RATE_LIMIT_MAX:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded. Please slow down."})
    _rate_limit_store[client].append(now)
    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    return response


# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception at %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc) if os.getenv("DEBUG") else "Please check server logs."},
    )

from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def spa_fallback_handler(request: Request, exc: StarletteHTTPException):
    """Serve index.html for SPA routes, but preserve API 404s."""
    if exc.status_code == 404 and request.method in ("GET", "HEAD"):
        path = request.url.path
        # Don't fallback for API, docs, or openapi routes
        if not path.startswith("/api/") and not path.startswith("/docs") and path not in ("/openapi.json",):
            # Don't fallback for static assets — return 404 so the browser
            # can reload and pick up the new hashed filename
            _static_exts = {".js", ".css", ".svg", ".png", ".jpg", ".ico", ".woff", ".woff2", ".map"}
            import posixpath
            ext = posixpath.splitext(path)[1].lower()
            if ext in _static_exts:
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            index_path = FRONTEND_DIST / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path), headers={"Cache-Control": "no-cache"})
    # Re-raise as JSON for API routes or other status codes
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

# Restrict CORS to localhost for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/api/graph")
def get_graph():
    graph_path = GRAPH / "graph.json"
    if not graph_path.exists():
        raise HTTPException(status_code=404, detail="Graph not found. Run build_graph first.")
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
    """Return the full content of wiki/index.md."""
    path = WIKI / "index.md"
    if not path.exists():
        return {"markdown": ""}
    return {"markdown": path.read_text(encoding="utf-8")}

@app.get("/api/log")
def get_log(tail: int = Query(0, ge=0, description="Return only the last N log entries. 0 = all.")):
    """Return the full or tail-truncated content of wiki/log.md."""
    path = WIKI / "log.md"
    if not path.exists():
        return {"markdown": ""}
    content = path.read_text(encoding="utf-8")
    if tail > 0:
        lines = content.splitlines()
        entry_indices = [i for i, line in enumerate(lines) if line.startswith("## [")]
        start_idx = entry_indices[-tail] if len(entry_indices) > tail else 0
        content = "\n".join(lines[start_idx:])
    return {"markdown": content}

@app.get("/api/overview")
def get_overview():
    """Return the full content of wiki/overview.md."""
    path = WIKI / "overview.md"
    if not path.exists():
        return {"markdown": ""}
    return {"markdown": path.read_text(encoding="utf-8")}

# ── FTS5 Search ────────────────────────────────────────────────────

# Lazy-initialized search engine singleton
_search_engine = None
_search_engine_lock = __import__('threading').Lock()

def _get_search_engine():
    global _search_engine
    if _search_engine is None:
        with _search_engine_lock:
            if _search_engine is None:
                from tools.search_engine import WikiSearchEngine
                _search_engine = WikiSearchEngine()
    return _search_engine


@app.get("/api/search/fts")
def search_fts(q: str = Query("", min_length=1), limit: int = Query(20, ge=1, le=100), semantic: bool = Query(False)):
    """Full-text search via SQLite FTS5. Returns ranked results with excerpts."""
    if not q or len(q.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    try:
        engine = _get_search_engine()
        results = engine.search(q.strip(), limit, semantic=semantic)
        return {"results": results, "count": len(results)}
    except Exception as e:
        logging.warning("Search failed: %s", e)
        # Degrade to plain substring search
        return {"results": _fallback_search(q.strip(), limit), "count": 0, "degraded": True}


@app.post("/api/search/reindex-embeddings")
async def reindex_embeddings():
    """Rebuild semantic embeddings for all wiki pages."""
    try:
        engine = _get_search_engine()
        await asyncio.to_thread(engine.rebuild_embeddings)
        return {"success": True}
    except Exception as e:
        logging.warning("Embedding reindex failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Reindex failed: {e}")


def _fallback_search(query: str, limit: int) -> list[dict]:
    """Fallback substring search when FTS5 is unavailable."""
    q_clean = query.lower()
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning("Fallback search skipped file: %s", e)
            continue
        if q_clean in content.lower():
            results.append({
                "path": str(p.relative_to(REPO)),
                "title": p.stem,
                "type": "unknown",
                "rank": 0,
                "excerpt": content[:300].replace("\n", " "),
            })
        if len(results) >= limit:
            break
    return results


@app.get("/api/search")
def search(q: str = Query("", min_length=1), limit: int = Query(50, ge=1, le=200)):
    if not q or len(q.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required and must be non-empty")
    q_clean = q.strip().lower()
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning("Fallback search skipped file: %s", e)
            continue
        if q_clean in content.lower():
            preview_raw = content[:200].replace("<", "&lt;").replace(">", "&gt;")
            results.append({
                "id": p.relative_to(WIKI).as_posix().replace(".md", ""),
                "path": str(p.relative_to(REPO)),
                "preview": preview_raw,
            })
            if len(results) >= limit:
                break
    return {"results": results, "total": len(results)}

@app.get("/api/health")
def health():
    pages = list(WIKI.rglob("*.md"))
    graph_exists = (GRAPH / "graph.json").exists()
    return {
        "pages": len(pages),
        "graph_ready": graph_exists,
        "litellm_available": LITELLM_AVAILABLE,
    }


@app.get("/api/index-etag")
def index_etag():
    """Return an ETag based on wiki/index.md mtime for frontend polling."""
    index_path = WIKI / "index.md"
    if index_path.exists():
        mtime = index_path.stat().st_mtime
        return str(int(mtime))
    return "0"


@app.get("/api/config/llm")
def get_llm_config_legacy():
    cfg = _load_llm_config()
    model = _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")
    model_fast = _resolve_model(cfg, "LLM_MODEL_FAST", "anthropic/claude-3-5-haiku-latest", model_key="model_fast")
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
        except Exception as e:
            logger.warning("File conversion failed: %s", e)

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
            "path": "graph/graph.json" if graph_exists else None,
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
            "model": _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest"),
            "api_key_set": bool(cfg.get("api_key")),
            "litellm_available": LITELLM_AVAILABLE,
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
            # Check if a corresponding source page exists in wiki/sources/
            source_path = REPO / "wiki" / "sources" / f"{p.stem}.md"
            files.append({
                "path": p.relative_to(REPO).as_posix(),
                "name": p.name,
                "size": p.stat().st_size,
                "modified": p.stat().st_mtime,
                "ingested": source_path.exists(),
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
    MAX_RAW_FILE_SIZE = 10 * 1024 * 1024
    if target.stat().st_size > MAX_RAW_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_RAW_FILE_SIZE // (1024*1024)}MB)")
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

    # Validate Content-Type against extension
    content_type = file.content_type or ""
    expected_types = {
        ".md": ["text/markdown", "text/plain"],
        ".txt": ["text/plain"],
        ".pdf": ["application/pdf"],
        ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        ".html": ["text/html"],
        ".csv": ["text/csv"],
        ".json": ["application/json"],
        ".xml": ["application/xml", "text/xml"],
        ".yaml": ["application/yaml", "text/yaml"],
        ".yml": ["application/yaml", "text/yaml"],
    }
    allowed = expected_types.get(suffix, [])
    if allowed and content_type and not any(content_type.startswith(a) for a in allowed):
        raise HTTPException(
            status_code=400,
            detail=f"Content-Type '{content_type}' does not match extension '{suffix}'"
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

    total_size = 0
    chunks = []
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large (max 20MB)")
        chunks.append(chunk)

    with open(target, "wb") as f:
        for chunk in chunks:
            f.write(chunk)

    converted = None
    if suffix.lower() not in (".md", ".txt"):
        try:
            def _do_convert():
                from markitdown import MarkItDown
                md = MarkItDown(enable_plugins=False)
                result = md.convert(str(target))
                cp = target.with_suffix(".md")
                cp.write_text(result.text_content, encoding="utf-8")
                return cp
            converted_path = await asyncio.to_thread(_do_convert)
            converted = converted_path.relative_to(REPO).as_posix()
        except Exception as e:
            logger.warning("Config back-compat cleanup failed: %s", e)
            pass

    return {
        "success": True,
        "path": target.relative_to(REPO).as_posix(),
        "converted_path": converted,
        "size": total_size,
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


# ── Multimodal Ingest (R22) ──

@app.post("/api/multimodal/describe")
async def multimodal_describe(file: UploadFile = File(...)):
    """Accept an image upload, describe it via multimodal_ingest, and return the description."""
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_SIZE // (1024 * 1024)}MB)")

    suffix = Path(file.filename or "image").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        from tools.multimodal_ingest import describe_image
        description = describe_image(tmp_path)
        if not description:
            raise HTTPException(
                status_code=503,
                detail="No vision backend available. Set GEMINI_API_KEY or OLLAMA_URL.",
            )
        return {"description": description, "saved_path": tmp_path}
    finally:
        # Keep temp file for potential debugging; cleanup is OS responsibility
        pass


@app.post("/api/multimodal/ingest")
async def multimodal_ingest_image(file: UploadFile = File(...)):
    """Accept an image upload, save to raw/, generate description, save as .md, and trigger ingest."""
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_SIZE // (1024 * 1024)}MB)")

    safe_name = Path(file.filename or "unnamed").name
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    raw_dir = REPO / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    image_path = raw_dir / safe_name
    counter = 1
    stem = image_path.stem
    suffix = image_path.suffix
    while image_path.exists():
        image_path = raw_dir / f"{stem}_{counter}{suffix}"
        counter += 1

    image_path.write_bytes(data)

    # Validate the resolved path stays within raw/
    try:
        image_path.resolve().relative_to(raw_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    from tools.multimodal_ingest import describe_image, save_description

    description = describe_image(str(image_path))
    if not description:
        raise HTTPException(
            status_code=503,
            detail="No vision backend available. Set GEMINI_API_KEY or OLLAMA_URL.",
        )

    md_path = save_description(str(image_path), description)

    # Trigger ingest of the description
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, str(REPO / "tools" / "ingest.py"), str(md_path)],
            capture_output=True,
            text=True,
            cwd=str(REPO),
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "description": description,
            "md_path": str(md_path.relative_to(REPO)),
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Ingest timed out after 5 minutes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")


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
        result = await asyncio.to_thread(
            subprocess.run,
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


# ── Webhook endpoints (P1-2 URL Clip + P1-6 Automation) ──

@app.post("/api/webhook/clip")
async def webhook_clip(payload: WebhookClipPayload, _=Depends(_require_webhook_token)):
    """Clip a URL via Jina Reader, save to raw/, and trigger ingest."""
    import urllib.request
    import urllib.error

    target_url = payload.url.strip()
    parsed = urllib.parse.urlparse(target_url)
    if not parsed.scheme:
        target_url = "https://" + target_url
        parsed = urllib.parse.urlparse(target_url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL scheme must be http or https")
    hostname = parsed.hostname or ""
    import ipaddress
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(status_code=400, detail="Private/internal URLs are not allowed")
    except ValueError:
        lower_host = hostname.lower()
        if lower_host in ("localhost",) or lower_host.endswith(".local"):
            raise HTTPException(status_code=400, detail="Private/internal URLs are not allowed")
    jina_api = f"https://r.jina.ai/{target_url}"

    def _fetch_jina():
        req = urllib.request.Request(
            jina_api,
            headers={"User-Agent": "LLM-Wiki-Agent/1.0"},
            timeout=30,
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")

    try:
        text = await asyncio.to_thread(_fetch_jina)
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Jina Reader failed: {e.code}")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {e}")

    if not text or len(text) < 100:
        raise HTTPException(status_code=502, detail="Jina Reader returned empty or too short content")

    # Save to raw/
    slug = re.sub(r"[^\w\s-]", "", payload.title or payload.url).strip().replace(" ", "-")[:60]
    if not slug:
        slug = "clipped"
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"{slug}-{timestamp}.md"
    raw_path = REPO / "raw" / filename

    safe_title = (payload.title or payload.url).replace("\\", "\\\\").replace('"', '\\"')
    safe_url = payload.url.replace("\\", "\\\\").replace('"', '\\"')
    header = f"""---
title: "{safe_title}"
type: source
tags: {json.dumps(payload.tags)}
date: {datetime.now().strftime('%Y-%m-%d')}
source_url: "{safe_url}"
---

"""
    try:
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(header + text, encoding="utf-8")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Trigger ingest
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, str(REPO / "tools" / "ingest.py"), str(raw_path)],
            capture_output=True,
            text=True,
            cwd=str(REPO),
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "filename": filename,
            "path": str(raw_path.relative_to(REPO)),
            "chars": len(text),
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "filename": filename,
            "path": str(raw_path.relative_to(REPO)),
            "chars": len(text),
            "error": "Ingest timed out after 5 minutes",
        }
    except Exception as e:
        return {
            "success": False,
            "filename": filename,
            "path": str(raw_path.relative_to(REPO)),
            "chars": len(text),
            "error": str(e),
        }


@app.post("/api/webhook/ingest")
async def webhook_ingest(payload: WebhookIngestPayload, _=Depends(_require_webhook_token)):
    """Generic webhook to trigger ingest of a raw file."""
    target = (REPO / payload.path).resolve()
    raw_dir = (REPO / "raw").resolve()
    try:
        target.relative_to(raw_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path must be within raw/")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        result = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, str(REPO / "tools" / "ingest.py"), str(target)],
            capture_output=True,
            text=True,
            cwd=str(REPO),
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "source": payload.source,
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Ingest timed out after 5 minutes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")


@app.post("/api/webhook/github")
async def webhook_github(request: Request, _=Depends(_require_webhook_token)):
    import hmac
    import hashlib

    body = await request.body()
    event = request.headers.get("X-GitHub-Event", "")

    github_secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "").strip()
    if github_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        if not signature:
            raise HTTPException(status_code=401, detail="Missing X-Hub-Signature-256 header")
        expected = "sha256=" + hmac.new(github_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    if event not in ("push", "ping"):
        raise HTTPException(status_code=400, detail=f"Unsupported event: {event}")

    if event == "ping":
        return {"success": True, "message": "pong"}

    try:
        result = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, str(REPO / "tools" / "refresh.py")],
            capture_output=True,
            text=True,
            cwd=str(REPO),
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "event": event,
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Refresh timed out after 5 minutes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refresh failed: {e}")


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


ALLOWED_CONFIG_NAMES = {"llm", "github", "app", "search", "github_sources", "rss_sources", "arxiv_sources", "web_sources"}

@app.post("/api/config/{name}")
async def save_config(name: str, request: Request):
    safe_name = Path(name).name
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid config name")
    if safe_name not in ALLOWED_CONFIG_NAMES:
        raise HTTPException(status_code=400, detail=f"Config name must be one of: {', '.join(sorted(ALLOWED_CONFIG_NAMES))}")
    path = REPO / "config" / f"{safe_name}.yaml"
    try:
        path.resolve().relative_to((REPO / "config").resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    path.parent.mkdir(parents=True, exist_ok=True)
    body = await request.body()
    if yaml:
        try:
            yaml.safe_load(body.decode("utf-8"))
        except yaml.YAMLError:
            raise HTTPException(status_code=400, detail="Invalid YAML content")
    path.write_text(body.decode("utf-8"), encoding="utf-8")
    return {"success": True, "path": str(path)}


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
        result = await asyncio.to_thread(
            subprocess.run,
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
LLM_API_KEY_PATH = REPO / ".cache" / "llm_api_key"
_llm_config_cache: dict = {}
_llm_config_cache_ts: float = 0.0
_LLM_CONFIG_TTL = 5.0


def _load_agent_context() -> str:
    """Load agent memory (MEMORY.md + USER.md) as system context string."""
    parts = []
    for name in ("MEMORY.md", "USER.md"):
        path = AGENT_DIR / name
        if path.exists():
            try:
                content = path.read_text(encoding="utf-8").strip()
                if content:
                    parts.append(content)
            except (OSError, UnicodeDecodeError):
                pass
    return "\n\n---\n\n".join(parts) if parts else ""


def _load_llm_config() -> dict:
    """Load LLM config from config/llm.yaml and apply env overrides. Cached with TTL.
    API key is loaded separately from .cache/llm_api_key for security."""
    global _llm_config_cache, _llm_config_cache_ts
    import time
    now = time.time()
    if _llm_config_cache and (now - _llm_config_cache_ts) < _LLM_CONFIG_TTL:
        return _llm_config_cache
    if not yaml or not LLM_CONFIG_PATH.exists():
        return {}
    try:
        cfg = yaml.safe_load(LLM_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except Exception as e:
        logger.warning("LLM config load failed: %s", e)
        return {}
    # Load API key from separate secure location
    if LLM_API_KEY_PATH.exists():
        api_key = LLM_API_KEY_PATH.read_text(encoding="utf-8").strip()
        if api_key:
            cfg["api_key"] = api_key
    # Back-compat: also check yaml if separate file doesn't exist
    elif cfg.get("api_key"):
        pass  # already in cfg
    if cfg.get("model"):
        os.environ.setdefault("LLM_MODEL", cfg["model"])
    if cfg.get("model_fast"):
        os.environ.setdefault("LLM_MODEL_FAST", cfg["model_fast"])
    provider = cfg.get("provider", "anthropic")
    api_key = cfg.get("api_key", "")
    if api_key:
        key_env = f"{provider.upper().replace('-', '_')}_API_KEY"
        os.environ[key_env] = api_key
    _llm_config_cache = cfg
    _llm_config_cache_ts = now
    return cfg


def _resolve_model(cfg: dict, env_var: str, default: str, model_key: str = "model") -> str:
    """Resolve model name, ensuring provider prefix for litellm."""
    model = cfg.get(model_key) or os.getenv(env_var, default)
    provider = cfg.get("provider", "anthropic")
    if "/" not in model:
        model = f"{provider}/{model}"
    return model


@app.post("/api/agent-kit/llm-chat")
async def agent_kit_llm_chat(request: Request):
    """Chat with LLM for agent-kit assistance (Skill / MCP generation, review, etc.)."""
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="litellm not installed. Run: pip install litellm")

    body = await request.json()
    messages = body.get("messages", [])
    system_prompt = body.get("system_prompt", "")

    if len(messages) > MAX_LLM_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Too many messages (max {MAX_LLM_MESSAGES})")
    total_size = sum(len(str(m.get("content", ""))) for m in messages) + len(system_prompt)
    if total_size > MAX_LLM_CONTENT_SIZE:
        raise HTTPException(status_code=400, detail=f"Total content too large (max {MAX_LLM_CONTENT_SIZE // 1024}KB)")

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    cfg = _load_llm_config()
    model = _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    kwargs: dict = {"model": model, "messages": full_messages, "max_tokens": 4096, "temperature": 0.7}
    if api_key:
        kwargs["api_key"] = api_key
    try:
        from litellm import completion
        response = await asyncio.to_thread(completion, **kwargs)
        content = response.choices[0].message.content
        return {"content": content}
    except (ImportError, ConnectionError, TimeoutError, OSError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")


@app.post("/api/agent-kit/llm-chat-stream")
async def agent_kit_llm_chat_stream(request: Request):
    """Stream LLM chat responses via SSE for agent-kit assistance."""
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="litellm not installed. Run: pip install litellm")

    body = await request.json()
    messages = body.get("messages", [])
    system_prompt = body.get("system_prompt", "")

    if len(messages) > MAX_LLM_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Too many messages (max {MAX_LLM_MESSAGES})")
    total_size = sum(len(str(m.get("content", ""))) for m in messages) + len(system_prompt)
    if total_size > MAX_LLM_CONTENT_SIZE:
        raise HTTPException(status_code=400, detail=f"Total content too large (max {MAX_LLM_CONTENT_SIZE // 1024}KB)")

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    cfg = _load_llm_config()
    model = _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    kwargs: dict = {"model": model, "messages": full_messages, "max_tokens": 4096, "stream": True, "temperature": 0.7}
    if api_key:
        kwargs["api_key"] = api_key

    async def event_generator():
        try:
            from litellm import acompletion
            response = await acompletion(**kwargs)
            async for chunk in response:
                try:
                    delta = chunk.choices[0].delta.content or ""
                except (IndexError, AttributeError):
                    continue
                if delta:
                    yield f"data: {json.dumps({'chunk': delta}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Wiki Chat (RAG) ──

class WikiChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)

class WikiChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Current user question")
    messages: list[WikiChatMessage] = Field(default_factory=list, description="Conversation history")
    context_pages: list[str] = Field(default_factory=list, description="Specific wiki pages to include as context")


@app.post("/api/wiki-chat")
@app.post("/api/wiki-chat/")
async def wiki_chat(payload: WikiChatRequest):
    """Chat with LLM using wiki knowledge as RAG context. Streams SSE."""
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="litellm not installed. Run: pip install litellm")

    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    # 1. Retrieve knowledge context
    sources = []
    knowledge_chunks = []
    if payload.context_pages:
        for wiki_path in payload.context_pages:
            path = (WIKI / wiki_path).resolve()
            try:
                path.relative_to(WIKI.resolve())
            except ValueError:
                continue
            if path.exists() and path.suffix == '.md':
                try:
                    content = path.read_text(encoding='utf-8')
                    snippet = _extract_relevant_snippets(content, query)
                    sources.append({"path": wiki_path, "preview": snippet[:200]})
                    knowledge_chunks.append(f"--- Source: {wiki_path} ---\n{snippet}\n")
                except (OSError, UnicodeDecodeError):
                    continue
    else:
        # Search wiki for relevant pages
        search_results = _search_wiki(query)
        for r in search_results:
            snippet = _extract_relevant_snippets(r["content"], query)
            sources.append({"path": r["wiki_path"], "preview": snippet[:200]})
            knowledge_chunks.append(f"--- Source: {r['wiki_path']} ---\n{snippet}\n")

    knowledge_context = "\n".join(knowledge_chunks)
    if not knowledge_context:
        knowledge_context = "No relevant wiki pages found."

    agent_ctx = _load_agent_context()
    system_prompt = (
        "You are a helpful assistant for the LLM Wiki knowledge base. "
        "Answer the user's question based ONLY on the following retrieved wiki content. "
        "If the answer is not in the retrieved content, say so clearly. "
        "Cite sources using [source: path/to/page] format."
        + (f"\n\nAgent memory and user preferences:\n{agent_ctx}" if agent_ctx else "")
        + f"\n\nRetrieved content:\n{knowledge_context}"
    )

    full_messages = [{"role": "system", "content": system_prompt}]
    for m in payload.messages:
        full_messages.append({"role": m.role, "content": m.content})
    full_messages.append({"role": "user", "content": query})

    cfg = _load_llm_config()
    model = _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    kwargs: dict = {"model": model, "messages": full_messages, "max_tokens": 4096, "stream": True, "temperature": 0.7}
    if api_key:
        kwargs["api_key"] = api_key

    async def event_generator():
        from litellm import acompletion
        # First event: searching status
        yield f"data: {json.dumps({'status': 'searching'}, ensure_ascii=False)}\n\n"
        # Second event: sources metadata
        yield f"data: {json.dumps({'sources': sources}, ensure_ascii=False)}\n\n"
        try:
            response = await acompletion(**kwargs)
            async for chunk in response:
                try:
                    delta = chunk.choices[0].delta.content or ""
                except (IndexError, AttributeError):
                    continue
                if delta:
                    yield f"data: {json.dumps({'chunk': delta}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Knowledge-based generation ──

MAX_WIKI_CHARS_PER_PAGE = 3000
MAX_SOURCES = 5


def _search_wiki(query: str, max_results: int = MAX_SOURCES) -> list[dict]:
    q_lower = query.strip().lower()
    if not q_lower:
        return []
    try:
        engine = _get_search_engine()
        fts_results = engine.search(query, limit=max_results)
        results = []
        for r in fts_results:
            p = REPO / r["path"]
            if not p.exists():
                continue
            try:
                content = p.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            results.append({
                "path": str(p.relative_to(REPO)),
                "wiki_path": str(p.relative_to(WIKI)),
                "score": r.get("rank", 0),
                "content": content,
            })
        if results:
            return results
    except Exception as e:
        logger.warning("Log parse failed: %s", e)
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
        score = 0
        for w in q_words:
            score += text_lower.count(w)
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
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="litellm not installed. Run: pip install litellm")

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
    model = _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")
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
        from litellm import completion
        response = await asyncio.to_thread(completion, **kwargs)
        raw_content = response.choices[0].message.content or ""
    except (ImportError, ConnectionError, TimeoutError, OSError, ValueError) as e:
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
    cfg = _load_llm_config()
    provider = cfg.get("provider", "anthropic")
    key_env = f"{provider.upper().replace('-', '_')}_API_KEY"
    api_key_set = bool(cfg.get("api_key") or os.getenv(key_env))
    if not api_key_set and LLM_API_KEY_PATH.exists():
        try:
            api_key_set = bool(LLM_API_KEY_PATH.read_text(encoding="utf-8").strip())
        except OSError:
            pass
    return {
        "model": cfg.get("model", os.getenv("LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")),
        "model_fast": cfg.get("model_fast", os.getenv("LLM_MODEL_FAST", "anthropic/claude-3-5-haiku-latest")),
        "provider": provider,
        "api_key_set": api_key_set,
    }


@app.post("/api/llm-config")
async def save_llm_config(payload: LLMConfigPayload):
    """Save LLM config to config/llm.yaml (api_key is stored separately in .cache/)."""
    if not yaml:
        raise HTTPException(status_code=500, detail="PyYAML not installed. Run: pip install pyyaml")
    cfg = {
        "model": payload.model,
        "model_fast": payload.model_fast,
        "provider": payload.provider,
    }
    api_key = payload.api_key
    # Store api_key in separate secure location, never in llm.yaml
    if api_key:
        LLM_API_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        LLM_API_KEY_PATH.write_text(api_key, encoding="utf-8")
    # Back-compat cleanup: remove any plaintext api_key from llm.yaml
    if LLM_CONFIG_PATH.exists():
        try:
            existing = yaml.safe_load(LLM_CONFIG_PATH.read_text(encoding="utf-8")) or {}
            if "api_key" in existing:
                existing.pop("api_key")
                LLM_CONFIG_PATH.write_text(yaml.safe_dump(existing, default_flow_style=False, sort_keys=False), encoding="utf-8")
        except Exception as e:
            logger.warning("Config back-compat cleanup failed: %s", e)
            pass
    LLM_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LLM_CONFIG_PATH.write_text(yaml.safe_dump(cfg, default_flow_style=False, sort_keys=False), encoding="utf-8")
    _load_llm_config()
    return {"success": True}


# ── MCP Management API ──

class MCPInstallRequest(BaseModel):
    name: str = Field(..., min_length=1)
    source: str = Field(..., pattern="^(npm|pip|url|local|generated)$")
    package: str = Field(default="")
    url: str = Field(default="")
    path: str = Field(default="")
    display_name: str = Field(default="")
    description: str = Field(default="")
    version: str = Field(default="1.0.0")
    transport: str = Field(default="stdio")
    tools: list[str] = Field(default_factory=list)
    config: dict = Field(default_factory=dict)
    code: str = Field(default="")
    requirements: str = Field(default="")


@app.get("/api/mcp/list")
def mcp_list():
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    return {"servers": get_mcp_manager().list_servers()}


@app.post("/api/mcp/install")
async def mcp_install(payload: MCPInstallRequest):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    kwargs = {
        "display_name": payload.display_name or payload.name,
        "description": payload.description,
        "version": payload.version,
        "transport": payload.transport,
        "tools": payload.tools,
        "config": payload.config,
        "code": payload.code,
        "requirements": payload.requirements,
        "package": payload.package,
        "url": payload.url,
        "path": payload.path,
    }
    result = get_mcp_manager().install(payload.name, payload.source, **kwargs)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.delete("/api/mcp/uninstall/{name}")
def mcp_uninstall(name: str):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    return get_mcp_manager().uninstall(name)


@app.post("/api/mcp/start/{name}")
def mcp_start(name: str):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    result = get_mcp_manager().start(name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/mcp/stop/{name}")
def mcp_stop(name: str):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    return get_mcp_manager().stop(name)


@app.post("/api/mcp/restart/{name}")
def mcp_restart(name: str):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    result = get_mcp_manager().restart(name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/api/mcp/status/{name}")
def mcp_status(name: str):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    return get_mcp_manager().status(name)


@app.get("/api/mcp/logs/{name}")
def mcp_logs(name: str, lines: int = Query(100, ge=1, le=1000)):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    return get_mcp_manager().logs(name, lines)


@app.post("/api/mcp/test/{name}")
def mcp_test(name: str):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    return get_mcp_manager().test(name)


@app.post("/api/mcp/call/{name}/{tool}")
async def mcp_call(name: str, tool: str, request: Request):
    if get_mcp_manager is None:
        raise HTTPException(status_code=500, detail="mcp_manager not available")
    body = await request.json()
    return get_mcp_manager().call_tool(name, tool, body.get("arguments", {}))


@app.post("/api/mcp/generate")
async def mcp_generate(request: Request):
    """Generate MCP Server code from a template."""
    body = await request.json()
    description = body.get("description", "")
    template = body.get("template", "wiki-search")
    name = body.get("name", "generated-server")

    templates = {
        "wiki-search": '''#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent
WIKI = REPO / "wiki"

mcp = FastMCP("{name}")

@mcp.tool()
def search_wiki(query: str) -> str:
    """Search wiki pages by keyword."""
    results = []
    q = query.lower()
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md"):
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if q in content.lower():
            results.append({{"id": str(p.relative_to(WIKI).with_suffix("")), "preview": content[:200]}})
    return json.dumps(results[:20], ensure_ascii=False)

if __name__ == "__main__":
    mcp.run()
''',
        "filesystem": '''#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent
ALLOWED = [REPO / "wiki", REPO / "raw", REPO / "graph"]

mcp = FastMCP("{name}")

def _safe(path: Path) -> bool:
    return any(path.resolve().is_relative_to(a.resolve()) for a in ALLOWED)

@mcp.tool()
def read_file(filepath: str) -> str:
    """Read a file within allowed directories."""
    p = Path(filepath).resolve()
    if not _safe(p):
        return json.dumps({{"error": "Access denied"}})
    if not p.exists():
        return json.dumps({{"error": "File not found"}})
    return p.read_text(encoding="utf-8")

if __name__ == "__main__":
    mcp.run()
''',
    }

    server_code = templates.get(template, templates["wiki-search"]).format(name=name)
    return {
        "template": template,
        "description": description,
        "files": {
            "server.py": server_code,
            "requirements.txt": "mcp>=1.2.0\n",
        },
    }


# ── Skill Management API ──

class SkillInstallRequest(BaseModel):
    name: str = Field(..., min_length=1)
    source: str = Field(default="generated", pattern="^(generated|local|url)$")
    path: str = Field(default="")
    version: str = Field(default="1.0.0")
    description: str = Field(default="")
    code: str = Field(default="")


class SkillExecuteRequest(BaseModel):
    input: str = Field(..., min_length=1)


@app.get("/api/skills/list")
def skills_list():
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    return {"skills": get_skill_engine().list_skills()}


@app.post("/api/skills/install")
async def skills_install(payload: SkillInstallRequest):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    kwargs = {
        "version": payload.version,
        "description": payload.description,
        "path": payload.path,
        "code": payload.code,
    }
    result = get_skill_engine().install(payload.name, payload.source, **kwargs)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.delete("/api/skills/uninstall/{name}")
def skills_uninstall(name: str):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    return get_skill_engine().uninstall(name)


@app.post("/api/skills/enable/{name}")
def skills_enable(name: str):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    result = get_skill_engine().enable(name)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/skills/disable/{name}")
def skills_disable(name: str):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    result = get_skill_engine().disable(name)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/skills/execute/{name}")
async def skills_execute(name: str, payload: SkillExecuteRequest):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    try:
        result = get_skill_engine().execute(name, payload.input)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {e}")
    # Stream LLM response if litellm is available
    if not LITELLM_AVAILABLE:
        return {"result": result, "error": "litellm not installed"}

    cfg = _load_llm_config()
    model = _resolve_model(cfg, "LLM_MODEL", "anthropic/claude-3-5-sonnet-latest")
    api_key = cfg.get("api_key", "")
    messages = [
        {"role": "system", "content": result.get("system_prompt", "")},
        {"role": "user", "content": result.get("user_prompt", payload.input)},
    ]
    kwargs: dict = {"model": model, "messages": messages, "max_tokens": 4096, "stream": True}
    if api_key:
        kwargs["api_key"] = api_key

    async def event_generator():
        try:
            from litellm import acompletion
            response = await acompletion(**kwargs)
            async for chunk in response:
                try:
                    delta = chunk.choices[0].delta.content or ""
                except (IndexError, AttributeError):
                    continue
                if delta:
                    yield f"data: {json.dumps({'chunk': delta}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/skills/match")
async def skills_match(request: Request):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    body = await request.json()
    user_input = body.get("input", "")
    matches = get_skill_engine().match_trigger(user_input)
    return {
        "input": user_input,
        "matches": [
            {"skill": m["skill"]["name"], "trigger": m["match"], "priority": m["config"].get("priority", 0)}
            for m in matches
        ],
    }


@app.post("/api/skills/generate")
async def skills_generate(request: Request):
    """Generate Skill from wiki knowledge (placeholder)."""
    body = await request.json()
    description = body.get("description", "")
    return {
        "description": description,
        "files": {
            "SKILL.md": f"# Generated Skill\n\n{description}\n",
            "config.json": '{"name":"generated","version":"1.0.0"}',
        },
    }


@app.get("/api/skills/templates")
def skills_templates():
    return {
        "templates": [
            {"name": "wiki-query", "description": "基于 wiki 知识库回答用户问题", "type": "rag"},
            {"name": "document-ingest", "description": "将文档摄入到 wiki 知识库", "type": "action"},
            {"name": "knowledge-graph", "description": "构建或重建知识图谱", "type": "action"},
            {"name": "content-lint", "description": "对 wiki 内容进行质量检查", "type": "action"},
            {"name": "mcp-generator", "description": "生成 MCP Server", "type": "generator"},
            {"name": "github-analyzer", "description": "分析 GitHub 项目并摄入", "type": "pipeline"},
            {"name": "export-kit", "description": "导出 Agent Kit", "type": "action"},
        ]
    }


@app.get("/api/skills/detail/{name}")
def skills_detail(name: str):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    detail = get_skill_engine().get_skill_detail(name)
    if "error" in detail:
        raise HTTPException(status_code=404, detail=detail["error"])
    return detail


@app.put("/api/skills/save/{name}")
async def skills_save(name: str, request: Request):
    if get_skill_engine is None:
        raise HTTPException(status_code=500, detail="skill_engine not available")
    body = await request.json()
    path = body.get("path", "")
    content = body.get("content", "")
    if not path:
        raise HTTPException(status_code=400, detail="path is required")
    result = get_skill_engine().save_skill_file(name, path, content)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Wiki Page Edit API (P1-3 Markdown Editor) ──

class WikiWritePayload(BaseModel):
    path: str = Field(..., min_length=1, description="Repo-relative path to wiki page")
    content: str = Field(..., min_length=1, description="Full markdown content")


@app.post("/api/wiki/write")
async def wiki_write(payload: WikiWritePayload):
    """Create or overwrite a wiki page. Path must be within wiki/ and end with .md."""
    if not payload.path.endswith(".md"):
        raise HTTPException(status_code=400, detail="Path must end with .md")
    target = (REPO / payload.path).resolve()
    try:
        target.relative_to(WIKI.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path must be within wiki/ directory")
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload.content, encoding="utf-8")
        return {"success": True, "path": payload.path, "bytes": len(payload.content.encode("utf-8"))}
    except (OSError, UnicodeEncodeError) as e:
        raise HTTPException(status_code=500, detail=f"Write failed: {e}")


# ── Graph Layout Save (P1-4 Graph Visualization Editing) ──

class GraphLayoutPayload(BaseModel):
    positions: dict = Field(default_factory=dict, description="Node ID → {x, y} positions")


@app.post("/api/graph/save-layout")
async def graph_save_layout(payload: GraphLayoutPayload):
    """Save node positions back to graph.json so layout persists across sessions."""
    graph_path = GRAPH / "graph.json"
    if not graph_path.exists():
        raise HTTPException(status_code=404, detail="graph.json not found")
    try:
        data = json.loads(graph_path.read_text(encoding="utf-8"))
        nodes = data.get("nodes", [])
        for node in nodes:
            nid = node.get("id")
            pos = payload.positions.get(nid)
            if pos and isinstance(pos, dict):
                node["x"] = pos.get("x")
                node["y"] = pos.get("y")
        data["nodes"] = nodes
        data["layout_saved"] = datetime.now().isoformat()
        graph_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"success": True, "nodes_updated": len([n for n in nodes if "x" in n])}
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to save layout: {e}")


# ── Wiki Tools API (lint / heal / refresh / build-graph) ──

class ToolRunPayload(BaseModel):
    args: list[str] = Field(default_factory=list, description="Extra CLI arguments")


def _run_tool_script(script_name: str, extra_args: list[str] | None = None) -> dict:
    """Run a tool script via subprocess and return structured result."""
    cmd = [sys.executable, str(REPO / "tools" / script_name)]
    if extra_args:
        cmd.extend(extra_args)
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
            "stdout": result.stdout[-2000:] if result.stdout else "",
            "stderr": result.stderr[-2000:] if result.stderr else "",
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "stdout": "", "stderr": "Timed out after 5 minutes", "returncode": -1}
    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e), "returncode": -1}


@app.get("/api/tools/list")
def tools_list():
    """List available wiki maintenance tools."""
    return {
        "tools": [
            {"name": "lint", "description": "Content quality checks (orphans, broken links, contradictions)", "endpoint": "/api/tools/lint", "method": "POST"},
            {"name": "heal", "description": "Auto-heal missing entity pages from context", "endpoint": "/api/tools/heal", "method": "POST"},
            {"name": "refresh", "description": "Refresh stale source pages via hash-based change detection", "endpoint": "/api/tools/refresh", "method": "POST"},
            {"name": "build-graph", "description": "Rebuild the knowledge graph with Louvain clustering", "endpoint": "/api/tools/build-graph", "method": "POST"},
        ]
    }


@app.post("/api/tools/lint")
async def tools_lint(payload: ToolRunPayload | None = None):
    """Run lint.py for content quality checks."""
    args = payload.args if payload else []
    if "--save" not in args:
        args.append("--save")
    result = await asyncio.to_thread(_run_tool_script, "lint.py", args)
    return result


@app.post("/api/tools/heal")
async def tools_heal(payload: ToolRunPayload | None = None):
    """Run heal.py to auto-generate missing entity pages."""
    args = payload.args if payload else []
    result = await asyncio.to_thread(_run_tool_script, "heal.py", args)
    return result


@app.post("/api/tools/refresh")
async def tools_refresh(payload: ToolRunPayload | None = None):
    """Run refresh.py to update stale source pages."""
    args = payload.args if payload else []
    result = await asyncio.to_thread(_run_tool_script, "refresh.py", args)
    return result


@app.post("/api/tools/build-graph")
async def tools_build_graph(payload: ToolRunPayload | None = None):
    """Run build_graph.py to rebuild the knowledge graph."""
    args = payload.args if payload else []
    result = await asyncio.to_thread(_run_tool_script, "build_graph.py", args)
    return result


# ── Web Fetcher (URL to article) ──
class FetchUrlPayload(BaseModel):
    url: str = Field(..., description="URL to fetch")
    name: str = Field(default="", description="Optional display name")
    tags: list[str] = Field(default_factory=list, description="Tags for the article")


@app.post("/api/fetch/url")
async def fetch_url_endpoint(payload: FetchUrlPayload):
    """Fetch a single web URL and extract article content via web_fetcher.py."""
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    result = await asyncio.to_thread(
        _run_tool_script, "fetchers/web_fetcher.py", ["--url", url]
    )
    # Parse stdout to find saved filename
    saved_file = None
    quality = None
    for line in result.get("stdout", "").split("\n"):
        if "[OK] Saved to" in line:
            parts = line.split("Saved to ")
            if len(parts) > 1:
                saved_file = parts[1].split(" ")[0]
        if "[Q=" in line:
            q_part = line.split("[Q=")[1].split("]")[0] if "[Q=" in line else ""
            quality = q_part
    return {
        "success": result["success"],
        "stdout": result["stdout"],
        "stderr": result["stderr"],
        "saved_file": saved_file,
        "quality": quality,
    }


# ── Web Crawler (batch) ──
@app.post("/api/crawler/run")
async def crawler_run():
    """Run web_fetcher.py with config to crawl all URLs in web_sources.yaml."""
    result = await asyncio.to_thread(
        _run_tool_script, "fetchers/web_fetcher.py", ["--config", "config/web_sources.yaml"]
    )
    stats = {"saved": 0, "skipped": 0, "errors": 0}
    for line in result.get("stdout", "").split("\n"):
        if "[OK] Saved" in line:
            stats["saved"] += 1
        elif "[SKIP]" in line:
            stats["skipped"] += 1
        elif "[ERROR]" in line or "[FALLBACK-ERR]" in line:
            stats["errors"] += 1
    return {**result, "stats": stats}


@app.post("/api/crawler/batch")
async def crawler_batch():
    """Run full pipeline: web_fetcher → batch_compiler → batch_ingest."""
    steps: list[dict] = []

    step1 = await asyncio.to_thread(
        _run_tool_script, "fetchers/web_fetcher.py", ["--config", "config/web_sources.yaml"]
    )
    steps.append({"name": "web_fetcher", **step1})
    if not step1["success"]:
        return {"success": False, "steps": steps, "stopped_at": "web_fetcher"}

    step2 = await asyncio.to_thread(
        _run_tool_script, "batch_compiler.py", ["--window", "daily"]
    )
    steps.append({"name": "batch_compiler", **step2})
    if not step2["success"]:
        return {"success": False, "steps": steps, "stopped_at": "batch_compiler"}

    step3 = await asyncio.to_thread(
        _run_tool_script, "batch_ingest.py", []
    )
    steps.append({"name": "batch_ingest", **step3})
    return {"success": step3["success"], "steps": steps}


# ── Collaborative Editing (R24) ──
_collab_connections: dict[str, set[WebSocket]] = defaultdict(set)


def _validate_collab_doc_id(doc_id: str) -> Path:
    """Validate doc_id resolves to a path within wiki/ and ends with .md."""
    if not doc_id or ".." in doc_id or doc_id.startswith("/"):
        raise ValueError("Invalid doc_id")
    if not doc_id.endswith(".md"):
        raise ValueError("doc_id must end with .md")
    target = (REPO / doc_id).resolve()
    try:
        target.relative_to(WIKI.resolve())
    except ValueError:
        raise ValueError("doc_id must be within wiki/")
    return target


async def _broadcast_to_room(doc_id: str, message: dict, exclude: WebSocket | None = None) -> None:
    """Broadcast a JSON message to all connected clients in a doc room."""
    dead: list[WebSocket] = []
    for ws in _collab_connections.get(doc_id, set()):
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception as e:
            logger.warning("WebSocket broadcast failed: %s", e)
            dead.append(ws)
    for ws in dead:
        _collab_connections[doc_id].discard(ws)


async def _broadcast_presence(doc_id: str) -> None:
    """Broadcast current user count to all clients in a doc room."""
    count = len(_collab_connections.get(doc_id, set()))
    await _broadcast_to_room(doc_id, {"type": "presence", "count": count})


@app.websocket("/api/ws/collab/{doc_id:path}")
async def collab_websocket(websocket: WebSocket, doc_id: str):
    """WebSocket endpoint for single-document collaborative editing.

    Protocol (JSON):
      Client -> Server: {"type": "update", "content": str, "cursor": int}
      Server -> Client: {"type": "update", "content": str, "cursor": int}
      Server -> Client: {"type": "presence", "count": int}
    """
    await websocket.accept()
    try:
        _validate_collab_doc_id(doc_id)
    except ValueError as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close(code=4000)
        return

    room = _collab_connections[doc_id]
    room.add(websocket)

    # Announce presence to all in room (including self so client knows count)
    await _broadcast_presence(doc_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "update":
                broadcast = {
                    "type": "update",
                    "content": data.get("content", ""),
                    "cursor": data.get("cursor", 0),
                }
                await _broadcast_to_room(doc_id, broadcast, exclude=websocket)
            elif msg_type == "cursor":
                broadcast = {
                    "type": "cursor",
                    "cursor": data.get("cursor", 0),
                }
                await _broadcast_to_room(doc_id, broadcast, exclude=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        room.discard(websocket)
        if not room:
            _collab_connections.pop(doc_id, None)
        else:
            await _broadcast_presence(doc_id)


# Serve frontend static files if dist exists
if FRONTEND_DIST.exists():
    for _sub in ("assets", "fonts", "locales", "data"):
        _dir = FRONTEND_DIST / _sub
        if _dir.is_dir():
            app.mount(f"/{_sub}", StaticFiles(directory=str(_dir)), name=f"static-{_sub}")

    @app.get("/{full_path:path}")
    async def spa_index(full_path: str):
        """Serve SPA index.html for all non-API, non-asset routes."""
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path), headers={"Cache-Control": "no-cache"})
        return FileResponse(str(FRONTEND_DIST / "index.html"), headers={"Cache-Control": "no-cache"})


def _check_port_available(host: str, port: int) -> bool:
    """Check if a TCP port is available for binding."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


# Load LLM config on startup
_load_llm_config()

if __name__ == "__main__":
    import uvicorn
    import argparse
    cli = argparse.ArgumentParser(description="LLM Wiki API Server")
    cli.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    cli.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    cli_args = cli.parse_args()

    if not _check_port_available(cli_args.host, cli_args.port):
        logger.error(
            "Port %d on %s is already in use. "
            "Try: python tools/api_server.py --port %d",
            cli_args.port, cli_args.host, cli_args.port + 1,
        )
        sys.exit(1)

    logger.info("Starting LLM Wiki API on http://%s:%d", cli_args.host, cli_args.port)
    uvicorn.run(app, host=cli_args.host, port=cli_args.port)
