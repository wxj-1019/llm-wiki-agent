#!/usr/bin/env python3
"""Fetch arXiv papers via the HTTP API and save as markdown.

Usage:
    python tools/fetchers/arxiv_fetcher.py --config config/arxiv_sources.yaml [--max-results 20]

Dependencies: none (uses stdlib only).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "arxiv"

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}


def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _fetch_atom(query: str, max_results: int) -> ET.Element | None:
    url = (
        "http://export.arxiv.org/api/query?"
        + urllib.parse.urlencode({
            "search_query": query,
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        })
    )
    req = urllib.request.Request(url, headers={"User-Agent": "llm-wiki-agent/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return ET.fromstring(resp.read())
    except Exception as e:
        print(f"  ⚠️  arXiv API error: {e}", file=sys.stderr)
        return None


def _extract_text(node: ET.Element | None, path: str) -> str:
    if node is None:
        return ""
    child = node.find(path, NS)
    return (child.text or "").strip() if child is not None else ""


def _write_entry(entry: ET.Element, query_label: str) -> Path | None:
    id_url = _extract_text(entry, "atom:id")
    url = id_url.replace("http://arxiv.org/abs/", "https://arxiv.org/abs/")
    state = _load_state()
    if url in state["processed_urls"]:
        return None

    title = _extract_text(entry, "atom:title")
    summary = _extract_text(entry, "atom:summary")
    published = _extract_text(entry, "atom:published")

    authors = []
    for author in entry.findall("atom:author", NS):
        name = _extract_text(author, "atom:name")
        if name:
            authors.append(name)

    categories = []
    for cat in entry.findall("atom:category", NS):
        term = cat.get("term")
        if term:
            categories.append(term)

    # Fetch abstract as body
    body = f"""# {title}

**Authors:** {', '.join(authors)}

**Categories:** {', '.join(categories)}

**Published:** {published}

**URL:** {url}

## Abstract

{summary}
"""

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = re.sub(r"[^\w\s-]", "", title.lower())[:60]
    slug = re.sub(r"[-\s]+", "-", slug).strip("-")
    filename = f"{date_prefix}-{slug}.md"
    out_path = OUT_DIR / filename
    counter = 1
    while out_path.exists():
        out_path = OUT_DIR / f"{date_prefix}-{slug}-{counter}.md"
        counter += 1

    fm = {
        "title": title.replace('"', '\\"'),
        "source_url": url,
        "published": published,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source_type": "arxiv",
        "query_label": query_label,
        "authors": ", ".join(authors),
        "categories": ", ".join(categories),
    }
    fm_lines = "\n".join(f'{k}: "{v}"' for k, v in fm.items())
    content = f"""---
{fm_lines}
---

{body}
"""
    out_path.write_text(content, encoding="utf-8")
    state["processed_urls"][url] = str(out_path.relative_to(REPO_ROOT).as_posix())
    _save_state(state)
    return out_path


def run(config_path: Path, max_results: int) -> int:
    try:
        import yaml
        cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))

    queries = cfg.get("queries", [])
    if not queries:
        print("No queries configured.", file=sys.stderr)
        return 1

    total = 0
    for q in queries:
        label = q.get("label", "unnamed")
        query = q["query"]
        print(f"Fetching arXiv: {label} ({query})")
        feed = _fetch_atom(query, max_results)
        if feed is None:
            continue
        entries = feed.findall("atom:entry", NS)
        saved = []
        for entry in entries:
            p = _write_entry(entry, label)
            if p:
                saved.append(p.name)
        if saved:
            print(f"  → {len(saved)} new papers")
            total += len(saved)
        else:
            print(f"  → no new papers")

    state = _load_state()
    state["last_runs"]["arxiv"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)
    print(f"\nDone. Total new papers: {total}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch arXiv papers for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--max-results", type=int, default=10)
    args = parser.parse_args()
    sys.exit(run(args.config, args.max_results))
