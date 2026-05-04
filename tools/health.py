#!/usr/bin/env python3
from __future__ import annotations

"""
Structural health checks for the LLM Wiki.

Unlike lint.py (which includes expensive LLM-powered semantic analysis),
health.py is purely deterministic — zero API calls, fast enough to run
every session.

Usage:
    python tools/health.py              # print report to stdout
    python tools/health.py --save       # also save to wiki/health-report.md
    python tools/health.py --json       # machine-readable output

Checks:
  - Empty / stub files (pages with no real content beyond frontmatter)
  - Index sync (wiki/index.md entries vs actual files on disk)
  - Log coverage (source pages without a corresponding log entry)

Design boundary (see AGENTS.md):
  health.py = structural integrity, deterministic, run every session
  lint.py   = content quality, semantic (LLM), run every 10-15 ingests
"""

import re
import sys
import json
import argparse
from pathlib import Path
from datetime import date

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
INDEX_FILE = WIKI_DIR / "index.md"
LOG_FILE = WIKI_DIR / "log.md"

# Minimum content length (excluding frontmatter) to not be considered a stub
STUB_THRESHOLD_CHARS = 100


# ── Shared utilities (with inline fallback) ─────────────────────────
try:
    from tools.shared.wiki import (
        read_file,
        all_wiki_pages,
        strip_frontmatter,
        extract_frontmatter_title,
    )
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def all_wiki_pages():
        exclude = {"index.md", "log.md", "lint-report.md", "health-report.md"}
        for p in WIKI_DIR.rglob("*.md"):
            if p.name not in exclude:
                yield p

    def strip_frontmatter(content: str) -> str:
        if content.startswith("---"):
            match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
            if match:
                return content[3 + match.end():].strip()
        return content.strip()

    def extract_frontmatter_title(content: str) -> str:
        match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
        return match.group(1).strip() if match else ""


try:
    from tools.shared.log import append_log
except ImportError:
    LOG_HEADER = (
        "# Wiki Log\n\n"
        "> Append-only chronological record of all operations.\n\n"
        "Format: `## [YYYY-MM-DD] <operation> | <title>`\n\n"
        "---\n"
    )

    def append_log(entry: str) -> None:
        entry_text = entry.strip()
        if not LOG_FILE.exists():
            LOG_FILE.write_text(LOG_HEADER + "\n" + entry_text + "\n", encoding="utf-8")
            return
        existing = read_file(LOG_FILE).strip()
        if existing.startswith("# Wiki Log"):
            parts = existing.split("\n---\n", 1)
            if len(parts) == 2:
                new_content = parts[0] + "\n---\n\n" + entry_text + "\n\n" + parts[1].strip()
            else:
                new_content = entry_text + "\n\n" + existing
        else:
            new_content = entry_text + "\n\n" + existing
        LOG_FILE.write_text(new_content, encoding="utf-8")


# ── Wikilink helpers ────────────────────────────────────────────────

def extract_wikilinks(content: str) -> list[str]:
    """Extract all [[WikiLink]] targets from page content.

    Handles both [[PageName]] and [[PageName|display alias]] formats.
    """
    return re.findall(r'\[\[([^\]]+)\]\]', content)


def all_wiki_page_stems() -> set[str]:
    """Return set of all wiki page stems (case-insensitive)."""
    pages = set()
    for p in all_wiki_pages():
        pages.add(p.stem.lower())
    return pages


# Section mapping for auto-indexing
SECTION_MAP = {
    "sources": "Sources",
    "entities": "Entities",
    "concepts": "Concepts",
    "syntheses": "Syntheses",
}


# ── Check: Empty / Stub files ───────────────────────────────────────

def check_empty_files(pages: list[Path], threshold: int = STUB_THRESHOLD_CHARS) -> list[dict]:
    """Find wiki pages that are empty or contain only frontmatter / minimal content."""
    results = []
    for p in pages:
        raw = read_file(p)
        body = strip_frontmatter(raw)
        if len(body) < threshold:
            results.append({
                "path": str(p.relative_to(REPO_ROOT)),
                "total_bytes": len(raw),
                "body_bytes": len(body),
                "status": "empty" if len(body) == 0 else "stub",
            })
    results.sort(key=lambda x: x["body_bytes"])
    return results


# ── Check: Index sync ───────────────────────────────────────────────

def _parse_index_links(index_content: str) -> set[str]:
    """Extract markdown link targets from index.md.

    Matches patterns like: [Title](sources/slug.md)
    Returns set of relative paths (e.g. 'sources/slug.md').
    """
    return set(re.findall(r'\[.*?\]\(([^)]+\.md)\)', index_content))


def check_index_sync(pages: list[Path]) -> dict:
    """Compare wiki/index.md entries against actual files on disk.

    Returns:
        {
            "in_index_not_on_disk": [...],   # stale index entries
            "on_disk_not_in_index": [...],   # missing from index
        }
    """
    index_content = read_file(INDEX_FILE)
    index_links = _parse_index_links(index_content)

    meta_pages = {"overview.md"}

    index_paths = set()
    for link in index_links:
        resolved = (WIKI_DIR / link).resolve()
        if Path(link).name not in meta_pages:
            index_paths.add(resolved)

    disk_paths = set()
    for p in pages:
        if p.name not in meta_pages:
            disk_paths.add(p.resolve())

    # Defensive guard: skip paths that somehow resolved outside the repo
    in_index_not_on_disk = [
        str(p.relative_to(REPO_ROOT)) for p in sorted(index_paths - disk_paths)
        if p.is_relative_to(REPO_ROOT)
    ]
    on_disk_not_in_index = [
        str(p.relative_to(REPO_ROOT)) for p in sorted(disk_paths - index_paths)
    ]

    return {
        "in_index_not_on_disk": in_index_not_on_disk,
        "on_disk_not_in_index": on_disk_not_in_index,
    }


# ── Check: Broken wikilinks ───────────────────────────────────────

def check_broken_links(pages: list[Path]) -> list[dict]:
    """Find wikilinks that point to non-existent pages.

    Handles [[PageName]] and [[PageName|alias]] formats.
    Only checks links targeting wiki pages (not external URLs).
    """
    existing_stems = all_wiki_page_stems()
    broken = []
    for p in pages:
        content = read_file(p)
        for link in extract_wikilinks(content):
            link_target = link.split("|")[0].strip()
            link_stem = Path(link_target.replace("\\", "/")).stem.lower()
            if link_stem not in existing_stems:
                broken.append({
                    "page": str(p.relative_to(REPO_ROOT)),
                    "link": link,
                })
    return broken


# ── Check: Log coverage ────────────────────────────────────────────

def _parse_log_entries(log_content: str) -> set[str]:
    """Extract page titles/slugs from log.md entries.

    Log format: ## [YYYY-MM-DD] ingest | Title Here
    Returns set of lowercase title strings.
    """
    return set(
        m.group(1).strip().lower()
        for m in re.finditer(r'^## \[\d{4}-\d{2}-\d{2}\] ingest \| (.+)$', log_content, re.MULTILINE)
    )


def check_log_coverage(pages: list[Path]) -> list[dict]:
    """Find source pages that have no corresponding ingest entry in log.md.

    Only checks wiki/sources/*.md — entity/concept pages are created as
    side-effects of ingest and don't need their own log entry.
    """
    log_content = read_file(LOG_FILE)
    logged_titles = _parse_log_entries(log_content)

    source_dir = WIKI_DIR / "sources"
    if not source_dir.exists():
        return []

    missing = []
    for p in sorted(source_dir.glob("*.md")):
        slug = p.stem.lower().replace("-", " ").replace("_", " ")
        content = read_file(p)
        title_match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
        fm_title = title_match.group(1).strip().lower() if title_match else ""

        if slug not in logged_titles and fm_title not in logged_titles:
            missing.append({
                "path": str(p.relative_to(REPO_ROOT)),
                "slug": p.stem,
                "title": fm_title or p.stem,
            })

    return missing


# ── Fix Helpers ─────────────────────────────────────────────────────

def fix_index_sync(pages: list[Path]) -> list[str]:
    """Auto-add missing pages to index.md. Returns list of actions taken."""
    sync = check_index_sync(pages)
    missing = sync["on_disk_not_in_index"]
    if not missing:
        return []

    index_content = read_file(INDEX_FILE)
    actions = []
    for rel_path in missing:
        p = REPO_ROOT / rel_path
        if not p.exists():
            continue
        content = read_file(p)
        title = extract_frontmatter_title(content) or p.stem
        parent = p.parent.name
        section = SECTION_MAP.get(parent, "Sources")
        entry = f"- [{title}]({Path(rel_path).as_posix()}) — {parent.rstrip('s')} page"

        section_header = f"## {section}"
        if section_header in index_content:
            if entry not in index_content:
                index_content = index_content.replace(
                    section_header + "\n",
                    section_header + "\n" + entry + "\n",
                )
                actions.append(f"Added {rel_path} to ## {section}")
        else:
            index_content += f"\n{section_header}\n{entry}\n"
            actions.append(f"Added {rel_path} to new ## {section}")

    if actions:
        INDEX_FILE.write_text(index_content, encoding="utf-8")
    return actions


def fix_log_coverage(pages: list[Path]) -> list[str]:
    """Auto-add missing log entries for source pages. Returns list of actions taken."""
    missing = check_log_coverage(pages)
    if not missing:
        return []

    today = date.today().isoformat()
    actions = []
    for item in missing:
        p = REPO_ROOT / item["path"]
        if not p.exists():
            continue
        title = item["title"] or item["slug"]
        entry = f"## [{today}] ingest | {title}\n\nAuto-added by health --fix."
        append_log(entry)
        actions.append(f"Added log entry for {item['path']}")
    return actions


# ── Report Generation ───────────────────────────────────────────────

def run_health() -> dict:
    """Run all health checks, return structured results."""
    pages = list(all_wiki_pages())

    return {
        "date": date.today().isoformat(),
        "total_pages": len(pages),
        "empty_files": check_empty_files(pages),
        "index_sync": check_index_sync(pages),
        "log_coverage": check_log_coverage(pages),
        "broken_links": check_broken_links(pages),
    }


def format_report(results: dict) -> str:
    """Format health check results as markdown."""
    lines = [
        f"# Wiki Health Report - {results['date']}",
        "",
        f"Scanned {results['total_pages']} wiki pages. "
        "Checks are purely structural (no LLM calls).",
        "",
    ]

    # ── Empty / Stub Files
    empty = results["empty_files"]
    lines.append(f"## Empty / Stub Files ({len(empty)} found)")
    lines.append("")
    if empty:
        lines.append("| Page | Total Bytes | Body Bytes | Status |")
        lines.append("|---|---|---|---|")
        for ef in empty:
            emoji = "[EMPTY]" if ef["status"] == "empty" else "[STUB]"
            lines.append(f"| `{ef['path']}` | {ef['total_bytes']} | {ef['body_bytes']} | {emoji} {ef['status']} |")
    else:
        lines.append("All pages have content beyond frontmatter. [OK]")
    lines.append("")

    # ── Index Sync
    isync = results["index_sync"]
    stale = isync["in_index_not_on_disk"]
    missing = isync["on_disk_not_in_index"]
    total_issues = len(stale) + len(missing)
    lines.append(f"## Index Sync ({total_issues} issues)")
    lines.append("")

    if stale:
        lines.append("### Stale Index Entries (in index.md but no file on disk)")
        for s in stale:
            lines.append(f"- `{s}`")
        lines.append("")

    if missing:
        lines.append("### Missing from Index (file exists but not in index.md)")
        for m in missing:
            lines.append(f"- `{m}`")
        lines.append("")

    if not stale and not missing:
        lines.append("index.md is in sync with disk. [OK]")
        lines.append("")

    # ── Broken Wikilinks
    broken = results["broken_links"]
    lines.append(f"## Broken Wikilinks ({len(broken)} found)")
    lines.append("")
    if broken:
        lines.append("These wikilinks point to pages that don't exist:")
        lines.append("")
        lines.append("| Page | Broken Link |")
        lines.append("|---|---|")
        for bl in broken:
            lines.append(f"| `{bl['page']}` | `[[{bl['link']}]]` |")
    else:
        lines.append("All wikilinks resolve to existing pages. [OK]")
    lines.append("")

    # ── Log Coverage
    log_missing = results["log_coverage"]
    lines.append(f"## Log Coverage ({len(log_missing)} source pages without log entry)")
    lines.append("")
    if log_missing:
        lines.append("These source pages have no corresponding `ingest` entry in log.md:")
        lines.append("")
        for lm in log_missing:
            lines.append(f"- `{lm['path']}` — {lm['title']}")
    else:
        lines.append("All source pages have corresponding log entries. [OK]")
    lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Structural health checks for the LLM Wiki (deterministic, no LLM calls)"
    )
    parser.add_argument("--save", action="store_true",
                        help="Save report to wiki/health-report.md")
    parser.add_argument("--json", action="store_true",
                        help="Output machine-readable JSON instead of markdown")
    parser.add_argument("--fix", action="store_true",
                        help="Auto-repair index sync and log coverage issues (stub files are reported only)")
    args = parser.parse_args()

    results = run_health()

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        report = format_report(results)
        print(report)

        if args.fix:
            pages = list(all_wiki_pages())
            fix_actions = []
            fix_actions.extend(fix_index_sync(pages))
            fix_actions.extend(fix_log_coverage(pages))
            if fix_actions:
                print("\n## Auto-Fix Actions")
                for action in fix_actions:
                    print(f"  ✓ {action}")
            else:
                print("\n## Auto-Fix Actions")
                print("  No repairs needed.")

        if args.save:
            report_path = WIKI_DIR / "health-report.md"
            report_path.write_text(report, encoding="utf-8")
            print(f"\nSaved: {report_path.relative_to(REPO_ROOT)}")
