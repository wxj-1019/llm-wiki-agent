#!/usr/bin/env python3
"""Archive stale source pages that have exceeded their TTL.

Scans wiki/sources/ for frontmatter with `ttl:` or `archive_after:`.
Moves expired pages to wiki/sources/archive/ and updates wiki/index.md.
Entity and concept pages are NEVER touched.

Usage:
    python tools/archive_stale.py [--dry-run] [--save-report]
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
WIKI_DIR = REPO_ROOT / "wiki"
SOURCES_DIR = WIKI_DIR / "sources"
ARCHIVE_DIR = SOURCES_DIR / "archive"
INDEX_PATH = WIKI_DIR / "index.md"


def _parse_frontmatter(text: str) -> dict[str, Any]:
    match = re.match(r"^---\n([\s\S]*?)\n---\n?", text)
    if not match:
        return {}
    meta: dict[str, Any] = {}
    for line in match[1].split("\n"):
        if ":" not in line:
            continue
        key, rest = line.split(":", 1)
        key = key.strip()
        val = rest.strip()
        # Simple heuristic: arrays in frontmatter [a, b]
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            val = [s.strip().strip('"').strip("'") for s in inner.split(",")] if inner else []
        elif val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        elif val.startswith("'") and val.endswith("'"):
            val = val[1:-1]
        # Try int
        try:
            val = int(val)
        except Exception:
            pass
        meta[key] = val
    return meta


def _is_expired(meta: dict[str, Any]) -> bool:
    now = datetime.now(timezone.utc)

    # 1) ttl in days from last_updated or date
    ttl = meta.get("ttl")
    if isinstance(ttl, int) and ttl > 0:
        date_str = meta.get("last_updated") or meta.get("date") or meta.get("fetched_at")
        if date_str:
            try:
                dt = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if now > dt + timedelta(days=ttl):
                    return True
            except Exception:
                pass

    # 2) explicit archive_after
    archive_after = meta.get("archive_after")
    if archive_after:
        try:
            dt = datetime.fromisoformat(str(archive_after).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if now > dt:
                return True
        except Exception:
            pass

    return False


def _remove_from_index(index_text: str, rel_path: str) -> str:
    # Remove the markdown list item that points to rel_path
    lines = index_text.split("\n")
    new_lines = []
    for line in lines:
        if rel_path in line and line.strip().startswith("-"):
            continue
        new_lines.append(line)
    return "\n".join(new_lines)


def run(dry_run: bool, save_report: bool) -> int:
    if not SOURCES_DIR.exists():
        print("No wiki/sources/ directory.")
        return 0

    expired: list[Path] = []
    for md in SOURCES_DIR.glob("*.md"):
        if md.name == "index.md":
            continue
        text = md.read_text(encoding="utf-8")
        meta = _parse_frontmatter(text)
        if meta.get("ttl") or meta.get("archive_after"):
            if _is_expired(meta):
                expired.append(md)

    if not expired:
        print("No stale source pages found.")
        return 0

    index_text = INDEX_PATH.read_text(encoding="utf-8") if INDEX_PATH.exists() else ""
    report_lines: list[str] = [f"# Archive Report ({datetime.now(timezone.utc).date().isoformat()})\n"]

    for md in expired:
        rel = str(md.relative_to(WIKI_DIR).as_posix())
        print(f"{'[dry-run] ' if dry_run else ''}Archiving: {rel}")
        report_lines.append(f"- {rel}")

        if dry_run:
            continue

        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        dest = ARCHIVE_DIR / md.name
        counter = 1
        while dest.exists():
            dest = ARCHIVE_DIR / f"{md.stem}-{counter}{md.suffix}"
            counter += 1
        md.rename(dest)

        if INDEX_PATH.exists():
            index_text = _remove_from_index(index_text, rel)

    if not dry_run and INDEX_PATH.exists():
        INDEX_PATH.write_text(index_text, encoding="utf-8")

    if save_report:
        report_path = WIKI_DIR / "archive-report.md"
        report_path.write_text("\n".join(report_lines), encoding="utf-8")
        print(f"\nReport saved: {report_path}")

    print(f"\nDone. {'Would archive' if dry_run else 'Archived'} {len(expired)} page(s).")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Archive stale wiki source pages")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--save-report", action="store_true")
    args = parser.parse_args()
    sys.exit(run(args.dry_run, args.save_report))
