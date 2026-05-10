#!/usr/bin/env python3
"""Fix broken wikilinks by converting them to plain text.

Usage:
    python tools/fix_broken_wikilinks.py [--dry-run]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
WIKI_DIR = REPO_ROOT / "wiki"


def _page_exists(link: str) -> bool:
    """Check if a wikilink target exists as a wiki page."""
    # Strip section anchors
    page_name = link.split("#")[0]
    # Try exact match
    candidates = [
        WIKI_DIR / f"{page_name}.md",
        WIKI_DIR / "sources" / f"{page_name}.md",
        WIKI_DIR / "entities" / f"{page_name}.md",
        WIKI_DIR / "concepts" / f"{page_name}.md",
        WIKI_DIR / "syntheses" / f"{page_name}.md",
    ]
    return any(c.exists() for c in candidates)


def _fix_line(line: str) -> tuple[str, int]:
    """Replace broken wikilinks with plain text. Returns (new_line, count_fixed)."""
    fixed = 0

    # Pattern: [[PageName|Display Text]] -> Display Text
    def repl_pipe(m: re.Match) -> str:
        nonlocal fixed
        page = m.group(1)
        display = m.group(2)
        if not _page_exists(page):
            fixed += 1
            return display
        return m.group(0)

    line = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", repl_pipe, line)

    # Pattern: [[PageName]] -> PageName
    def repl_simple(m: re.Match) -> str:
        nonlocal fixed
        page = m.group(1)
        if not _page_exists(page):
            fixed += 1
            return page
        return m.group(0)

    line = re.sub(r"\[\[([^|\]]+)\]\]", repl_simple, line)
    return line, fixed


def fix_all(dry_run: bool = False) -> int:
    total_fixed = 0
    for md_file in WIKI_DIR.rglob("*.md"):
        text = md_file.read_text(encoding="utf-8")
        lines = text.splitlines()
        new_lines = []
        file_fixed = 0
        for line in lines:
            new_line, count = _fix_line(line)
            new_lines.append(new_line)
            file_fixed += count

        if file_fixed:
            print(f"{'[DRY-RUN] ' if dry_run else ''}{md_file.relative_to(REPO_ROOT)}: fixed {file_fixed} links")
            total_fixed += file_fixed
            if not dry_run:
                md_file.write_text("\n".join(new_lines) + ("\n" if text.endswith("\n") else ""), encoding="utf-8")

    return total_fixed


def main() -> int:
    parser = argparse.ArgumentParser(description="Fix broken wikilinks")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    total = fix_all(dry_run=args.dry_run)
    print(f"\nTotal broken links {'would be ' if args.dry_run else ''}fixed: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
