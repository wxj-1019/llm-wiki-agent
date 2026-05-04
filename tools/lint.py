#!/usr/bin/env python3
from __future__ import annotations

"""
Lint the LLM Wiki for health issues.

Usage:
    python tools/lint.py
    python tools/lint.py --save          # save lint report to wiki/lint-report.md

Checks:
  - Orphan pages (no inbound wikilinks from other pages)
  - Broken wikilinks (pointing to pages that don't exist)
  - Missing entity pages (entities mentioned in 3+ pages but no page)
  - Contradictions between pages
  - Data gaps and suggested new sources
"""

import re
import sys
import json
import argparse
import statistics
from pathlib import Path
from collections import defaultdict
from datetime import date

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
GRAPH_DIR = REPO_ROOT / "graph"
GRAPH_JSON = GRAPH_DIR / "graph.json"
LOG_FILE = WIKI_DIR / "log.md"

# Fix Windows console encoding for Unicode output
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# ── Shared wiki utilities (with inline fallback) ────────────────────
try:
    from tools.shared.wiki import (
        read_file,
        all_wiki_pages,
    )
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def all_wiki_pages():
        exclude = {"index.md", "log.md", "lint-report.md", "health-report.md"}
        for p in WIKI_DIR.rglob("*.md"):
            if p.name not in exclude:
                yield p


def extract_wikilinks(content: str) -> list[str]:
    """Extract wikilink targets, stripping display aliases."""
    links = re.findall(r'\[\[([^\]]+)\]\]', content)
    return [link.split('|')[0].strip() for link in links]


def page_name_to_path(name: str, pages: list[Path]) -> list[Path]:
    """Find page(s) whose stem matches *name* (case-insensitive)."""
    candidates = []
    for p in pages:
        if p.stem.lower() == name.lower() or p.stem == name:
            candidates.append(p)
    return candidates


# ── Shared LLM utilities (with inline fallback) ─────────────────────
try:
    from tools.shared.llm import _load_llm_config, call_llm, LLMUnavailableError
except ImportError:
    import os

    def _load_llm_config() -> dict:
        cfg_path = REPO_ROOT / "config" / "llm.yaml"
        defaults = {
            "provider": "anthropic",
            "model": "anthropic/claude-3-5-sonnet-latest",
            "api_key": "",
            "api_base": "",
        }
        if cfg_path.exists():
            try:
                import yaml
                data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
                return {**defaults, **data}
            except Exception:
                pass
        return defaults

    class LLMUnavailableError(Exception):
        pass

    def call_llm(prompt: str, model_env: str, default_model: str, max_tokens: int = 4096) -> str:
        try:
            from litellm import completion
        except ImportError:
            raise LLMUnavailableError("litellm not installed")

        cfg = _load_llm_config()
        model = cfg.get("model") or os.getenv(model_env, default_model)
        provider = cfg.get("provider", "anthropic")
        if "/" not in model:
            model = f"{provider}/{model}"
        api_key = cfg.get("api_key", "")

        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }
        if api_key:
            kwargs["api_key"] = api_key

        response = completion(**kwargs)
        return response.choices[0].message.content


# ── Shared log utilities (with inline fallback) ─────────────────────
try:
    from tools.shared.log import append_log
except ImportError:
    LOG_HEADER = (
        "# Wiki Log\n\n"
        "> Append-only chronological record of all operations.\n\n"
        "Format: `## [YYYY-MM-DD] <operation> | <title>`\n\n"
        "Parse recent entries: `grep \"^## \\[\" wiki/log.md | tail -10`\n\n"
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


# ── Structural checks ───────────────────────────────────────────────

def find_orphans(pages: list[Path]) -> list[Path]:
    inbound = defaultdict(int)
    for p in pages:
        content = read_file(p)
        for link in extract_wikilinks(content):
            resolved = page_name_to_path(link, pages)
            for r in resolved:
                inbound[r] += 1
    return [p for p in pages if inbound[p] == 0 and p != WIKI_DIR / "overview.md"]


def find_broken_links(pages: list[Path]) -> list[tuple[Path, str]]:
    broken = []
    for p in pages:
        content = read_file(p)
        for link in extract_wikilinks(content):
            if not page_name_to_path(link, pages):
                broken.append((p, link))
    return broken


def find_missing_entities(pages: list[Path]) -> list[str]:
    """Find entity-like names mentioned in 3+ pages but lacking their own page."""
    mention_counts: dict[str, int] = defaultdict(int)
    existing_pages = {p.stem.lower() for p in pages}
    for p in pages:
        content = read_file(p)
        # Deduplicate links per-page before counting
        links = set(extract_wikilinks(content))
        for link in links:
            if link.lower() not in existing_pages:
                mention_counts[link] += 1
    return [name for name, count in mention_counts.items() if count >= 3]


def check_link_density(pages: list[Path], min_outbound: int = 2) -> list[dict]:
    """Find pages with fewer than min_outbound outgoing wikilinks.

    Pages without enough outgoing connections contribute to wiki fragmentation.
    Excludes overview.md (which is a synthesis page with different linking patterns).
    """
    results = []
    for p in pages:
        if p.name == "overview.md":
            continue
        content = read_file(p)
        links = extract_wikilinks(content)
        unique_links = set(link.lower() for link in links)
        if len(unique_links) < min_outbound:
            results.append({
                "path": str(p.relative_to(REPO_ROOT)),
                "outbound_links": len(unique_links),
                "links": sorted(unique_links),
            })
    results.sort(key=lambda x: x["outbound_links"])
    return results


# ── Graph-aware checks ──────────────────────────────────────────────

def load_graph_data() -> dict | None:
    """Load graph.json if it exists. Returns None if missing (graceful degradation)."""
    if not GRAPH_JSON.exists():
        return None
    try:
        text = GRAPH_JSON.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            text = GRAPH_JSON.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            text = GRAPH_JSON.read_text(encoding="utf-8", errors="replace")
    try:
        return json.loads(text)
    except (json.JSONDecodeError, IOError):
        print("  [warn] graph.json is corrupted — skipping graph-aware checks")
        return None


def _build_degree_map(graph_data: dict) -> dict[str, int]:
    """Build node_id -> degree mapping from graph edges."""
    degrees: dict[str, int] = {}
    for node in graph_data.get("nodes", []):
        degrees[node["id"]] = 0
    for edge in graph_data.get("edges", []):
        degrees[edge["from"]] = degrees.get(edge["from"], 0) + 1
        degrees[edge["to"]] = degrees.get(edge["to"], 0) + 1
    return degrees


def _build_community_map(graph_data: dict) -> dict[str, int]:
    """Build node_id -> community_id mapping from graph nodes."""
    return {
        node["id"]: node.get("group", -1)
        for node in graph_data.get("nodes", [])
    }


def check_hub_stubs(graph_data: dict, pages: list[Path], min_content_chars: int = 500) -> list[dict]:
    """Find god nodes (degree > μ+2σ) with suspiciously short content."""
    degrees = _build_degree_map(graph_data)
    deg_values = list(degrees.values())
    if len(deg_values) < 2:
        return []

    mean_deg = statistics.mean(deg_values)
    std_deg = statistics.stdev(deg_values)
    threshold = mean_deg + 2 * std_deg

    node_to_path: dict[str, Path] = {}
    for p in pages:
        nid = p.relative_to(WIKI_DIR).as_posix().replace(".md", "")
        node_to_path[nid] = p

    results = []
    for node_id, deg in degrees.items():
        if deg <= threshold:
            continue
        path = node_to_path.get(node_id)
        if not path:
            continue
        content_len = len(read_file(path))
        if content_len < min_content_chars:
            results.append({
                "node_id": node_id,
                "degree": deg,
                "content_len": content_len,
                "path": str(path.relative_to(REPO_ROOT)),
            })
    return sorted(results, key=lambda x: x["degree"], reverse=True)


def check_fragile_bridges(graph_data: dict) -> list[dict]:
    """Find community pairs connected by only 1 edge."""
    comm_map = _build_community_map(graph_data)
    cross_comm: dict[tuple[int, int], list[dict]] = {}

    for edge in graph_data.get("edges", []):
        ca = comm_map.get(edge["from"], -1)
        cb = comm_map.get(edge["to"], -1)
        if ca < 0 or cb < 0 or ca == cb:
            continue
        key = (min(ca, cb), max(ca, cb))
        cross_comm.setdefault(key, []).append(edge)

    return [
        {
            "comm_a": pair[0],
            "comm_b": pair[1],
            "bridge_from": edges[0]["from"],
            "bridge_to": edges[0]["to"],
        }
        for pair, edges in sorted(cross_comm.items())
        if len(edges) == 1
    ]


def check_isolated_communities(graph_data: dict) -> list[dict]:
    """Find communities with zero external edges (knowledge silos)."""
    comm_map = _build_community_map(graph_data)

    comm_members: dict[int, list[str]] = {}
    for node_id, comm_id in comm_map.items():
        if comm_id < 0:
            continue
        comm_members.setdefault(comm_id, []).append(node_id)

    has_external = set()
    for edge in graph_data.get("edges", []):
        ca = comm_map.get(edge["from"], -1)
        cb = comm_map.get(edge["to"], -1)
        if ca >= 0 and cb >= 0 and ca != cb:
            has_external.add(ca)
            has_external.add(cb)

    results = []
    for comm_id, members in sorted(comm_members.items()):
        if len(members) < 2:
            continue
        if comm_id not in has_external:
            results.append({
                "community_id": comm_id,
                "node_count": len(members),
                "members": members[:10],
            })
    return results


def run_lint():
    pages = list(all_wiki_pages())
    today = date.today().isoformat()

    if not pages:
        print("Wiki is empty. Nothing to lint.")
        return ""

    print(f"Linting {len(pages)} wiki pages...")

    orphans = find_orphans(pages)
    broken = find_broken_links(pages)
    missing_entities = find_missing_entities(pages)

    print(f"  orphans: {len(orphans)}")
    print(f"  broken links: {len(broken)}")
    print(f"  missing entity pages: {len(missing_entities)}")

    sparse_pages = check_link_density(pages)
    print(f"  sparse pages (< 2 outbound links): {len(sparse_pages)}")

    # ── Graph-aware checks ──
    graph_data = load_graph_data()
    hub_stubs: list[dict] = []
    fragile_bridges: list[dict] = []
    isolated_comms: list[dict] = []

    if graph_data and graph_data.get("nodes") and graph_data.get("edges"):
        print("  running graph-aware checks...")
        hub_stubs = check_hub_stubs(graph_data, pages)
        fragile_bridges = check_fragile_bridges(graph_data)
        isolated_comms = check_isolated_communities(graph_data)
        print(f"    hub stubs: {len(hub_stubs)}")
        print(f"    fragile bridges: {len(fragile_bridges)}")
        print(f"    isolated communities: {len(isolated_comms)}")
    elif graph_data:
        print("  [skip] graph.json has no data — skipping graph-aware checks")
    else:
        print("  [skip] no graph.json — run build_graph.py first for graph-aware checks")

    # Build context for semantic checks
    # Sample up to 50 pages for semantic lint (increased from 20 for better coverage)
    sample = sorted(pages, key=lambda p: p.relative_to(REPO_ROOT).as_posix())[:50]
    pages_context = ""
    for p in sample:
        rel = p.relative_to(REPO_ROOT)
        pages_context += f"\n\n### {rel}\n{read_file(p)[:1500]}"

    semantic_report = ""
    try:
        print("  running semantic lint via API...")
        prompt = f"""You are linting an LLM Wiki. Review the pages below and identify:
1. Contradictions between pages (claims that conflict)
2. Stale content (summaries that newer sources have superseded)
3. Data gaps (important questions the wiki can't answer — suggest specific sources to find)
4. Concepts mentioned but lacking depth

Wiki pages (sample of {len(sample)} pages):
{pages_context}

Return a markdown lint report with these sections:
## Contradictions
## Stale Content
## Data Gaps & Suggested Sources
## Concepts Needing More Depth

Be specific — name the exact pages and claims involved.
"""
        semantic_report = call_llm(prompt, "LLM_MODEL", "claude-3-5-sonnet-latest", max_tokens=3000)
    except LLMUnavailableError:
        print("  [skip] semantic lint requires litellm. Install with: pip install litellm")
        semantic_report = (
            "## Semantic Checks (skipped)\n\n"
            "> [!note]\n"
            "> Semantic linting (contradictions, stale content, data gaps) requires `litellm`.\n"
            "> Structural checks above completed successfully.\n"
            "> Install with: `pip install litellm` to enable semantic analysis."
        )

    # Compose full report
    report_lines = [
        f"# Wiki Lint Report — {today}",
        "",
        f"Scanned {len(pages)} pages.",
        "",
        "## Structural Issues",
        "",
    ]

    if orphans:
        report_lines.append("### Orphan Pages (no inbound links)")
        for p in orphans:
            report_lines.append(f"- `{p.relative_to(REPO_ROOT)}`")
        report_lines.append("")

    if broken:
        report_lines.append("### Broken Wikilinks")
        for page, link in broken:
            report_lines.append(f"- `{page.relative_to(REPO_ROOT)}` links to `[[{link}]]` — not found")
        report_lines.append("")

    if missing_entities:
        report_lines.append("### Missing Entity Pages (mentioned 3+ times but no page)")
        report_lines.append("> [!warning] Action Required\n> Run `python tools/heal.py` to automatically materialize these missing hubs."
        )
        for name in missing_entities:
            report_lines.append(f"- `[[{name}]]`")
        report_lines.append("")

    has_structural_issues = bool(orphans or broken or missing_entities or sparse_pages)
    if not has_structural_issues:
        report_lines.append("No structural issues found.")
        report_lines.append("")

    if sparse_pages:
        report_lines.append(f"### Sparse Pages — Low Outbound Link Density ({len(sparse_pages)} pages)")
        report_lines.append("These pages have fewer than 2 outbound wikilinks. Add connections to prevent orphan accumulation:")
        report_lines.append("")
        report_lines.append("| Page | Outbound Links | Existing Links |")
        report_lines.append("|---|---|---|")
        for sp in sparse_pages:
            existing = ", ".join(f"`[[{l}]]`" for l in sp["links"]) if sp["links"] else "—"
            report_lines.append(f"| `{sp['path']}` | {sp['outbound_links']} | {existing} |")
        report_lines.append("")

    # ── Graph-Aware Issues section ──
    report_lines.append("## Graph-Aware Issues")
    report_lines.append("")

    if not graph_data:
        report_lines.append("> [!tip]")
        report_lines.append("> Graph-aware checks were skipped. Run `python tools/build_graph.py` first, then re-run lint.")
        report_lines.append("")
    elif not graph_data.get("nodes") or not graph_data.get("edges"):
        report_lines.append("> [!tip]")
        report_lines.append("> Graph data is empty. Ingest sources and run `python tools/build_graph.py` to populate.")
        report_lines.append("")
    else:
        report_lines.append(f"### Hub Pages with Insufficient Content ({len(hub_stubs)} pages)")
        if hub_stubs:
            report_lines.append("These hub nodes carry disproportionate connectivity but have thin content:")
            report_lines.append("")
            report_lines.append("| Page | Degree | Content Length | Status |")
            report_lines.append("|---|---|---|---|")
            for hs in hub_stubs:
                status = "🔴 stub" if hs["content_len"] < 250 else "🟡 thin"
                report_lines.append(f"| `{hs['path']}` | {hs['degree']} | {hs['content_len']} chars | {status} |")
        else:
            report_lines.append("No hub stubs detected — all high-degree nodes have sufficient content.")
        report_lines.append("")

        report_lines.append(f"### Fragile Bridges ({len(fragile_bridges)} community pairs)")
        if fragile_bridges:
            report_lines.append("These community connections rely on a single edge — one broken link isolates them:")
            for fb in fragile_bridges:
                report_lines.append(f"- Community {fb['comm_a']} ↔ Community {fb['comm_b']} via `{fb['bridge_from']}` → `{fb['bridge_to']}`")
        else:
            report_lines.append("No fragile bridges — all community connections have redundant links.")
        report_lines.append("")

        report_lines.append(f"### Isolated Communities ({len(isolated_comms)} communities)")
        if isolated_comms:
            report_lines.append("These communities have zero external connections — knowledge silos:")
            report_lines.append("")
            report_lines.append("| Community | Nodes | Members |")
            report_lines.append("|---|---|---|")
            for ic in isolated_comms:
                members_str = ", ".join(ic["members"][:5])
                if ic["node_count"] > 5:
                    members_str += ", …"
                report_lines.append(f"| {ic['community_id']} | {ic['node_count']} | {members_str} |")
        else:
            report_lines.append("No isolated communities — all clusters have external connections.")
        report_lines.append("")

    report_lines.append("---")
    report_lines.append("")
    report_lines.append(semantic_report)

    report = "\n".join(report_lines)
    print("\n" + report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lint the LLM Wiki")
    parser.add_argument("--save", action="store_true", help="Save lint report to wiki/lint-report.md")
    args = parser.parse_args()

    report = run_lint()

    if args.save and report:
        report_path = WIKI_DIR / "lint-report.md"
        report_path.write_text(report, encoding="utf-8")
        print(f"\nSaved: {report_path.relative_to(REPO_ROOT)}")

    today = date.today().isoformat()
    append_log(f"## [{today}] lint | Wiki health check\n\nRan lint. See lint-report.md for details.")
