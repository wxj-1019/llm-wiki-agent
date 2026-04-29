#!/usr/bin/env python3
"""Compile fetched markdown files into weekly batches for ingestion.

Deduplicates by source_url, groups by source_type + week, and produces
raw-inbox/batches/batch-<type>-<week>.md ready for batch_ingest.py.

Usage:
    python tools/batch_compiler.py [--window daily|weekly] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
FETCHED_DIR = REPO_ROOT / "raw-inbox" / "fetched"
BATCH_DIR = REPO_ROOT / "raw-inbox" / "batches"
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"


def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}, "compiled": []}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _parse_frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n([\s\S]*?)\n---\n?", text)
    if not match:
        return {}
    meta: dict[str, str] = {}
    for line in match[1].split("\n"):
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        meta[key.strip()] = val.strip().strip('"').strip("'")
    return meta


def _week_key(dt: datetime) -> str:
    return dt.strftime("%Y-W%W")


def _day_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def run(window: str, dry_run: bool) -> int:
    state = _load_state()
    compiled = set(state.get("compiled", []))

    files: list[Path] = []
    if FETCHED_DIR.exists():
        for subdir in FETCHED_DIR.iterdir():
            if subdir.is_dir():
                files.extend(subdir.glob("*.md"))

    if not files:
        print("No fetched files to compile.")
        return 0

    # Group by (source_type, window)
    groups: dict[tuple[str, str], list[tuple[Path, dict[str, str], str]]] = defaultdict(list)
    for f in files:
        if str(f.relative_to(REPO_ROOT).as_posix()) in compiled:
            continue
        text = f.read_text(encoding="utf-8")
        fm = _parse_frontmatter(text)
        source_type = fm.get("source_type", "misc")
        fetched_at = fm.get("fetched_at", "")
        try:
            dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.now(timezone.utc)
        wk = _day_key(dt) if window == "daily" else _week_key(dt)
        groups[(source_type, wk)].append((f, fm, text))

    if not groups:
        print("No new files to compile (all already processed).")
        return 0

    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    total_batches = 0
    total_entries = 0

    for (source_type, wk), items in sorted(groups.items()):
        # Deduplicate by source_url within batch
        seen_urls: set[str] = set()
        unique_items = []
        for f, fm, text in items:
            url = fm.get("source_url", "")
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            unique_items.append((f, fm, text))

        if not unique_items:
            continue

        batch_name = f"batch-{source_type}-{wk}"
        batch_path = BATCH_DIR / f"{batch_name}.md"

        parts: list[str] = []
        parts.append(f"# Batch: {source_type} | {wk}\n")
        parts.append(f"This batch contains {len(unique_items)} item(s) compiled from fetched sources.\n")

        for idx, (f, fm, text) in enumerate(unique_items, 1):
            # Strip original frontmatter, keep body
            body = re.sub(r"^---\n[\s\S]*?\n---\n?", "", text, count=1).strip()
            title = fm.get("title", "Untitled")
            url = fm.get("source_url", "")
            parts.append(f"\n## Entry {idx}: {title}\n")
            if url:
                parts.append(f"Source: {url}\n")
            parts.append(body)
            parts.append("\n---\n")

        content = "\n".join(parts)
        if not dry_run:
            batch_path.write_text(content, encoding="utf-8")
            for f, _, _ in unique_items:
                compiled.add(str(f.relative_to(REPO_ROOT).as_posix()))
            state["compiled"] = sorted(compiled)
            _save_state(state)

        print(f"{'[dry-run] ' if dry_run else ''}{batch_name}: {len(unique_items)} entries")
        total_batches += 1
        total_entries += len(unique_items)

    print(f"\nDone. {total_batches} batch file(s), {total_entries} total entries.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile fetched sources into batches")
    parser.add_argument("--window", choices=["daily", "weekly"], default="weekly",
                        help="Grouping window (default: weekly)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would happen without writing files")
    args = parser.parse_args()
    sys.exit(run(args.window, args.dry_run))
