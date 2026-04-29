#!/usr/bin/env python3
from __future__ import annotations

"""Lightweight API server for LLM Wiki Agent."""

import json
import re
import sys
import subprocess
from pathlib import Path
from fastapi import FastAPI, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

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
async def upload_text(payload: dict):
    title = payload.get("title", "").strip()
    content = payload.get("content", "")
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
async def api_ingest(payload: dict):
    path_str = payload.get("path", "")
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


# Serve frontend static files if dist exists
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")

if __name__ == "__main__":
    import uvicorn
    import argparse
    cli = argparse.ArgumentParser(description="LLM Wiki API Server")
    cli.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    cli.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    cli_args = cli.parse_args()
    uvicorn.run(app, host=cli_args.host, port=cli_args.port)
