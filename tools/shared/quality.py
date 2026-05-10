#!/usr/bin/env python3
"""Page quality scoring system for the wiki."""
from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


def _read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter as a dict (simple key-value parser, no yaml dependency)."""
    if not content.startswith("---"):
        return {}
    end = content.find("\n---", 3)
    if end < 0:
        return {}
    block = content[3:end]
    result = {}
    for line in block.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, val = line.partition(":")
            result[key.strip()] = val.strip().strip('"').strip("'")
    return result


def _count_wikilinks(content: str) -> int:
    """Count unique wikilink targets."""
    links = re.findall(r'\[\[([^\]]+)\]\]', content)
    targets = set(link.split("|")[0].strip() for link in links)
    return len(targets)


def _count_inbound_refs(page_name: str, wiki_dir: Path) -> int:
    """Count how many other pages reference this page via [[wikilinks]]."""
    count = 0
    pattern = re.compile(r'\[\[' + re.escape(page_name) + r'(?:\|[^\]]+)?\]\]', re.IGNORECASE)
    for md_file in wiki_dir.rglob("*.md"):
        if md_file.stem == page_name:
            continue
        try:
            content = md_file.read_text(encoding="utf-8")[:5000]
            if pattern.search(content):
                count += 1
        except (OSError, UnicodeDecodeError):
            continue
    return count


def score_page(path: Path) -> dict:
    """Score a wiki page on multiple quality dimensions.

    Returns:
        {
            "path": str,
            "total": 0-100,
            "dimensions": {
                "completeness": 0-20,
                "link_density": 0-20,
                "freshness": 0-20,
                "content_depth": 0-20,
                "cross_reference": 0-20
            },
            "suggestions": [str]
        }
    """
    content = _read_file(path)
    if not content:
        return {
            "path": str(path),
            "total": 0,
            "dimensions": {k: 0 for k in ("completeness", "link_density", "freshness", "content_depth", "cross_reference")},
            "suggestions": ["Page is empty or unreadable"],
        }

    fm = _parse_frontmatter(content)
    suggestions = []
    dims = {}

    completeness = 0
    if fm.get("title"):
        completeness += 5
    else:
        suggestions.append("Add 'title' to frontmatter")
    if fm.get("type"):
        completeness += 5
    else:
        suggestions.append("Add 'type' to frontmatter")
    if fm.get("tags"):
        completeness += 3
    else:
        suggestions.append("Add 'tags' to frontmatter")
    if fm.get("sources"):
        completeness += 3
    if fm.get("last_updated") or fm.get("date"):
        completeness += 4
    else:
        suggestions.append("Add 'last_updated' to frontmatter")
    dims["completeness"] = completeness

    outbound = _count_wikilinks(content)
    if outbound == 0:
        link_score = 0
        suggestions.append("Add [[wikilinks]] to related pages")
    elif outbound == 1:
        link_score = 5
        suggestions.append("Add more [[wikilinks]] (currently 1, recommended >=3)")
    elif outbound == 2:
        link_score = 10
    elif outbound == 3:
        link_score = 15
    else:
        link_score = 20
    dims["link_density"] = link_score

    last_updated_str = fm.get("last_updated") or fm.get("date") or ""
    freshness = 10
    if last_updated_str:
        try:
            last_updated = datetime.strptime(last_updated_str, "%Y-%m-%d").date()
            days_old = (date.today() - last_updated).days
            if days_old <= 7:
                freshness = 20
            elif days_old <= 30:
                freshness = 15
            elif days_old <= 90:
                freshness = 10
            elif days_old <= 365:
                freshness = 5
            else:
                freshness = 0
                suggestions.append(f"Page is {days_old} days old — consider updating")
        except (ValueError, TypeError):
            freshness = 10
    dims["freshness"] = freshness

    char_count = len(content)
    if char_count > 3000:
        depth = 20
    elif char_count > 2000:
        depth = 15
    elif char_count > 1000:
        depth = 10
    elif char_count > 500:
        depth = 5
    else:
        depth = 0
        suggestions.append(f"Page is very short ({char_count} chars) — add more content")

    has_code = "```" in content
    has_blockquote = "\n>" in content
    if has_code:
        depth = min(20, depth + 2)
    if has_blockquote:
        depth = min(20, depth + 2)
    dims["content_depth"] = depth

    page_name = path.stem
    wiki_dir = REPO_ROOT / "wiki"
    inbound = _count_inbound_refs(page_name, wiki_dir)
    if inbound == 0:
        xref = 0
        suggestions.append("No other pages link to this page — it may be an orphan")
    elif inbound == 1:
        xref = 5
    elif inbound == 2:
        xref = 10
    elif inbound == 3:
        xref = 15
    else:
        xref = 20
    dims["cross_reference"] = xref

    total = sum(dims.values())
    return {
        "path": str(path.relative_to(REPO_ROOT)),
        "total": total,
        "dimensions": dims,
        "suggestions": suggestions,
    }


def score_all_pages() -> list[dict]:
    """Score all wiki pages. Return sorted by total score (ascending = worst first)."""
    wiki_dir = REPO_ROOT / "wiki"
    if not wiki_dir.exists():
        return []
    exclude = {"index.md", "log.md", "lint-report.md", "health-report.md"}
    results = []
    for md_file in wiki_dir.rglob("*.md"):
        if md_file.name in exclude:
            continue
        if ".agent" in md_file.parts:
            continue
        try:
            results.append(score_page(md_file))
        except Exception:
            results.append({
                "path": str(md_file.relative_to(REPO_ROOT)),
                "total": 0,
                "dimensions": {},
                "suggestions": ["Error scoring page"],
            })
    results.sort(key=lambda x: x["total"])
    return results


def get_quality_summary() -> dict:
    """Return quality distribution summary."""
    all_scores = score_all_pages()
    if not all_scores:
        return {"total_pages": 0, "avg_score": 0, "distribution": {}, "worst_10": []}

    scores = [s["total"] for s in all_scores]
    avg = sum(scores) / len(scores)

    excellent = sum(1 for s in scores if s >= 80)
    good = sum(1 for s in scores if 60 <= s < 80)
    poor = sum(1 for s in scores if s < 60)

    worst_10 = []
    for s in all_scores[:10]:
        top_issue = s["suggestions"][0] if s["suggestions"] else "No issues"
        worst_10.append({
            "path": s["path"],
            "score": s["total"],
            "top_issue": top_issue,
        })

    return {
        "total_pages": len(all_scores),
        "avg_score": round(avg, 1),
        "distribution": {
            "excellent(80+)": excellent,
            "good(60-80)": good,
            "poor(<60)": poor,
        },
        "worst_10": worst_10,
    }
