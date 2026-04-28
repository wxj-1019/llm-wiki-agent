#!/usr/bin/env python3
from __future__ import annotations

"""Lightweight API server for LLM Wiki Agent."""

import json
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
GRAPH = REPO / "graph"
FRONTEND_DIST = REPO / "wiki-viewer" / "dist"

app = FastAPI(title="LLM Wiki API")
# Restrict CORS to localhost for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
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
