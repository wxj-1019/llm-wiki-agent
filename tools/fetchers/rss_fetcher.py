#!/usr/bin/env python3
"""Fetch RSS/Atom feeds and save entries as markdown files for later batch ingestion.

Usage:
    python tools/fetchers/rss_fetcher.py --config config/rss_sources.yaml [--max-per-feed 10]

Dependencies: none (uses stdlib only).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "rss"

# Common RSS/Atom namespaces
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
}


def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _fetch_xml(url: str, timeout: int = 30) -> ET.Element | None:
    req = urllib.request.Request(url, headers={"User-Agent": "llm-wiki-agent/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        return ET.fromstring(data)
    except Exception as e:
        print(f"  ⚠️  Failed to fetch {url}: {e}", file=sys.stderr)
        return None


def _extract_text(node: ET.Element | None, path: str, ns: dict[str, str] | None = None) -> str:
    if node is None:
        return ""
    child = node.find(path, ns or {})
    return (child.text or "").strip() if child is not None else ""


def _parse_atom(feed: ET.Element, feed_name: str, max_items: int) -> list[dict[str, str]]:
    entries = []
    for entry in feed.findall("atom:entry", NS)[:max_items]:
        title = _extract_text(entry, "atom:title", NS)
        link_el = entry.find("atom:link[@rel='alternate']", NS)
        if link_el is None:
            link_el = entry.find("atom:link", NS)
        url = link_el.get("href") if link_el is not None else ""
        published = _extract_text(entry, "atom:published", NS) or _extract_text(entry, "atom:updated", NS)
        summary = _extract_text(entry, "atom:summary", NS)
        # Some Atom feeds embed full content in atom:content
        content = _extract_text(entry, "atom:content", NS)
        body = content or summary
        entries.append({
            "title": title,
            "url": url,
            "published": published,
            "body": body,
            "feed_name": feed_name,
        })
    return entries


def _parse_rss(feed: ET.Element, feed_name: str, max_items: int) -> list[dict[str, str]]:
    entries = []
    channel = feed.find("channel")
    if channel is None:
        return entries
    for item in channel.findall("item")[:max_items]:
        title = _extract_text(item, "title")
        url = _extract_text(item, "link")
        published = _extract_text(item, "pubDate") or _extract_text(item, "dc:date", NS)
        # Prefer content:encoded if available
        body = _extract_text(item, "content:encoded", NS) or _extract_text(item, "description")
        entries.append({
            "title": title,
            "url": url,
            "published": published,
            "body": body,
            "feed_name": feed_name,
        })
    return entries


def _slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def _write_entry(entry: dict[str, str]) -> Path | None:
    if not entry["url"]:
        return None
    state = _load_state()
    if entry["url"] in state["processed_urls"]:
        return None

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = _slugify(entry["title"]) or "untitled"
    filename = f"{date_prefix}-{slug}.md"
    out_path = OUT_DIR / filename
    counter = 1
    while out_path.exists():
        filename = f"{date_prefix}-{slug}-{counter}.md"
        out_path = OUT_DIR / filename
        counter += 1

    body_clean = entry["body"].replace("---", "—")  # avoid breaking frontmatter
    content = f"""---
title: "{entry['title'].replace('"', '\\"')}"
source_url: "{entry['url']}"
published: "{entry['published']}"
fetched_at: "{datetime.now(timezone.utc).isoformat()}"
source_type: "rss"
feed_name: "{entry['feed_name']}"
---

{body_clean}
"""
    out_path.write_text(content, encoding="utf-8")
    state["processed_urls"][entry["url"]] = str(out_path.relative_to(REPO_ROOT).as_posix())
    _save_state(state)
    return out_path


def run(config_path: Path, max_per_feed: int) -> int:
    import yaml  # optional; fallback to JSON if missing
    try:
        cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))

    feeds = cfg.get("feeds", [])
    if not feeds:
        print("No feeds configured.", file=sys.stderr)
        return 1

    total_new = 0
    for feed in feeds:
        name = feed.get("name", "unnamed")
        url = feed["url"]
        print(f"Fetching: {name} ({url})")
        root = _fetch_xml(url)
        if root is None:
            continue

        tag = root.tag.lower()
        if tag.endswith("feed"):
            entries = _parse_atom(root, name, max_per_feed)
        elif tag.endswith("rss") or tag == "rss":
            entries = _parse_rss(root, name, max_per_feed)
        else:
            # Try Atom first, then RSS
            entries = _parse_atom(root, name, max_per_feed)
            if not entries:
                entries = _parse_rss(root, name, max_per_feed)

        new_files = []
        for e in entries:
            p = _write_entry(e)
            if p:
                new_files.append(p.name)
        if new_files:
            print(f"  → {len(new_files)} new entries")
            total_new += len(new_files)
        else:
            print(f"  → no new entries")

    state = _load_state()
    state["last_runs"]["rss"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)
    print(f"\nDone. Total new entries: {total_new}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch RSS feeds for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, required=True, help="Path to YAML/JSON config file")
    parser.add_argument("--max-per-feed", type=int, default=10, help="Max entries per feed")
    args = parser.parse_args()
    sys.exit(run(args.config, args.max_per_feed))
