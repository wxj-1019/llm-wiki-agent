#!/usr/bin/env python3
from __future__ import annotations

"""Lightweight API server for LLM Wiki Agent."""

import json
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
GRAPH = REPO / "graph"
FRONTEND_DIST = REPO / "wiki-viewer" / "dist"

app = FastAPI(title="LLM Wiki API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

@app.get("/api/graph")
def get_graph():
    data = (GRAPH / "graph.json").read_text(encoding="utf-8-sig")
    return json.loads(data)

@app.get("/api/pages/{page_type}/{slug}")
def get_page(page_type: str, slug: str):
    path = WIKI / page_type / f"{slug}.md"
    if not path.exists():
        return {"error": "Not found"}, 404
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

@app.get("/api/search")
def search(q: str = Query("")):
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md"):
            continue
        content = p.read_text(encoding="utf-8")
        if q.lower() in content.lower():
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
