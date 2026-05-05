#!/usr/bin/env python3
from __future__ import annotations

"""
Build the knowledge graph from the wiki.

Usage:
    python tools/build_graph.py               # full rebuild
    python tools/build_graph.py --no-infer    # skip semantic inference (faster)
    python tools/build_graph.py --open        # open graph.html in browser after build

Outputs:
    graph/graph.json    — node/edge data (cached by SHA256)
    graph/graph.html    — interactive vis.js visualization

Edge types:
    EXTRACTED   — explicit [[wikilink]] in a page
    INFERRED    — Claude-detected implicit relationship
    AMBIGUOUS   — low-confidence inferred relationship
"""

import re
import json
import hashlib
import argparse
import statistics
import webbrowser
from pathlib import Path
from datetime import date

import os
import sys

# Ensure project root is on sys.path so `tools.shared` imports work when the
# script is executed directly (sys.path[0] becomes the script's directory).
REPO_ROOT = Path(__file__).parent.parent
_repo_root_str = str(REPO_ROOT)
if _repo_root_str not in sys.path:
    sys.path.insert(0, _repo_root_str)

try:
    import networkx as nx
    from networkx.algorithms import community as nx_community
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    print("Warning: networkx not installed. Community detection disabled. Run: pip install networkx")
WIKI_DIR = REPO_ROOT / "wiki"
GRAPH_DIR = REPO_ROOT / "graph"
GRAPH_JSON = GRAPH_DIR / "graph.json"
GRAPH_HTML = GRAPH_DIR / "graph.html"
CACHE_FILE = GRAPH_DIR / ".cache.json"
INFERRED_EDGES_FILE = GRAPH_DIR / ".inferred_edges.jsonl"
LOG_FILE = WIKI_DIR / "log.md"
SCHEMA_FILE = REPO_ROOT / "CLAUDE.md"

# ── Shared utilities (with inline fallback) ──
try:
    from tools.shared.llm import _load_llm_config, call_llm
except ImportError:
    def _load_llm_config() -> dict:
        cfg_path = REPO_ROOT / "config" / "llm.yaml"
        defaults = {"provider": "anthropic", "model": "anthropic/claude-3-5-sonnet-latest", "api_key": "", "api_base": ""}
        if cfg_path.exists():
            try:
                import yaml
                data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
                return {**defaults, **data}
            except Exception:
                pass
        return defaults

    def call_llm(prompt: str, model_env: str, default_model: str, max_tokens: int = 4096) -> str:
        try:
            from litellm import completion
        except ImportError:
            print("Error: litellm not installed. Run: pip install litellm")
            import sys
            sys.exit(1)

        cfg = _load_llm_config()
        model = cfg.get("model") or os.getenv(model_env, default_model)
        provider = cfg.get("provider", "anthropic")
        if "/" not in model:
            model = f"{provider}/{model}"
        api_key = cfg.get("api_key", "")

        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}]
        }

        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        if api_key:
            kwargs["api_key"] = api_key

        response = completion(**kwargs)
        return response.choices[0].message.content

try:
    from tools.shared.graph_html import render_html, TYPE_COLORS, EDGE_COLORS
except ImportError:
    TYPE_COLORS = {
        "source": "#4CAF50",
        "entity": "#2196F3",
        "concept": "#FF9800",
        "synthesis": "#9C27B0",
        "unknown": "#9E9E9E",
    }
    EDGE_COLORS = {
        "EXTRACTED": "#555555",
        "INFERRED": "#FF5722",
        "AMBIGUOUS": "#BDBDBD",
    }
    def render_html(nodes: list[dict], edges: list[dict]) -> str:
        return "<html><body><h1>Graph visualization unavailable (tools.shared.graph_html missing)</h1></body></html>"

try:
    from tools.shared.wiki import read_file, all_wiki_pages, extract_wikilinks, strip_frontmatter, extract_frontmatter_type, page_id
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def all_wiki_pages():
        exclude = {"index.md", "log.md", "lint-report.md", "health-report.md"}
        for p in WIKI_DIR.rglob("*.md"):
            if ".agent" in p.parts or p.name in exclude:
                continue
            yield p

    def extract_wikilinks(content: str) -> list[str]:
        return list(set(re.findall(r'\[\[([^\]]+)\]\]', content)))

    def strip_frontmatter(content: str) -> str:
        if content.startswith("---"):
            match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
            if match:
                return content[3 + match.end():].strip()
        return content.strip()

    def extract_frontmatter_type(content: str) -> str:
        match = re.search(r'^type:\s*(\S+)', content, re.MULTILINE)
        return match.group(1).strip('"\'') if match else "unknown"

    def page_id(path: Path) -> str:
        return path.relative_to(WIKI_DIR).as_posix().replace(".md", "")

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
    def append_log(entry: str):
        log_path = WIKI_DIR / "log.md"
        entry_text = entry.strip()
        if not log_path.exists():
            log_path.write_text(LOG_HEADER + "\n" + entry_text + "\n", encoding="utf-8")
            return
        existing = read_file(log_path).strip()
        if existing.startswith("# Wiki Log"):
            parts = existing.split("\n---\n", 1)
            if len(parts) == 2:
                new_content = parts[0] + "\n---\n\n" + entry_text + "\n\n" + parts[1].strip()
            else:
                new_content = entry_text + "\n\n" + existing
        else:
            new_content = entry_text + "\n\n" + existing
        log_path.write_text(new_content, encoding="utf-8")


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def edge_id(src: str, target: str, edge_type: str) -> str:
    return f"{src}->{target}:{edge_type}"


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_cache(cache: dict):
    GRAPH_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def extract_frontmatter_tags(content: str) -> list[str]:
    m = re.search(r'^tags:\s*\[([^\]]*)\]', content, re.MULTILINE)
    if m:
        return [t.strip().strip('"').strip("'") for t in m.group(1).split(',') if t.strip()]
    m2 = re.search(r'^tags:\s*$', content, re.MULTILINE)
    if m2:
        rest = content[m2.end():]
        items = re.findall(r'^\s*-\s*(.+)', rest, re.MULTILINE)
        return [i.strip().strip('"').strip("'") for i in items]
    return []


def extract_frontmatter_field(content: str, field: str) -> str | None:
    m = re.search(rf'^{field}:\s*"?([^"\n]+)"?', content, re.MULTILINE)
    return m.group(1).strip() if m else None


def build_nodes(pages: list[Path]) -> list[dict]:
    nodes = []
    for p in pages:
        content = read_file(p)
        node_type = extract_frontmatter_type(content)
        title_match = re.search(r'^title:\s*"?([^"\n]+)"?', content, re.MULTILINE)
        label = title_match.group(1).strip() if title_match else p.stem
        body = strip_frontmatter(content)
        preview_lines = [line.strip() for line in body.splitlines() if line.strip()]
        preview = " ".join(preview_lines[:3])[:220]
        tags = extract_frontmatter_tags(content)
        last_updated = extract_frontmatter_field(content, "last_updated") or extract_frontmatter_field(content, "date")
        node = {
            "id": page_id(p),
            "label": label,
            "type": node_type,
            "color": TYPE_COLORS.get(node_type, TYPE_COLORS["unknown"]),
            "path": p.relative_to(REPO_ROOT).as_posix(),
            "preview": preview,
        }
        if tags:
            node["tags"] = tags
        if last_updated:
            node["last_updated"] = last_updated
        nodes.append(node)
    return nodes


def build_extracted_edges(pages: list[Path]) -> list[dict]:
    """Pass 1: deterministic wikilink edges."""
    # Build a map from stem (lower) -> list of page_ids for resolution.
    # Multiple pages may share a stem (e.g. sources/RAG.md and concepts/RAG.md).
    stem_map: dict[str, list[str]] = {}
    for p in pages:
        stem_map.setdefault(p.stem.lower(), []).append(page_id(p))
    edges = []
    seen = set()
    for p in pages:
        content = read_file(p)
        src = page_id(p)
        for link in extract_wikilinks(content):
            # Handle [[PageName|display alias]] format — extract page name before |
            link_target = link.split("|")[0].strip()
            candidates = stem_map.get(link_target.lower(), [])
            for target in candidates:
                if target != src:
                    key = (src, target)
                    if key not in seen:
                        seen.add(key)
                        edges.append({
                            "id": edge_id(src, target, "EXTRACTED"),
                            "from": src,
                            "to": target,
                            "type": "EXTRACTED",
                            "color": EDGE_COLORS["EXTRACTED"],
                            "confidence": 1.0,
                        })
    return edges


def load_checkpoint() -> tuple[list[dict], set[str]]:
    """Load previously inferred edges from JSONL checkpoint file."""
    edges = []
    completed = set()
    if INFERRED_EDGES_FILE.exists():
        for line in INFERRED_EDGES_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                record = json.loads(line)
                completed.add(record["page_id"])
                for edge in record.get("edges", []):
                    if not isinstance(edge, dict) or "from" not in edge or "to" not in edge:
                        continue
                    rel_type = edge.get("type", "INFERRED")
                    edges.append({
                        "id": edge.get("id", edge_id(edge["from"], edge["to"], rel_type)),
                        "from": edge["from"],
                        "to": edge["to"],
                        "type": rel_type,
                        "title": edge.get("title", edge.get("relationship", "")),
                        "label": edge.get("label", ""),
                        "color": edge.get("color", EDGE_COLORS.get(rel_type, EDGE_COLORS["INFERRED"])),
                        "confidence": float(edge.get("confidence", 0.7)),
                    })
            except (json.JSONDecodeError, KeyError):
                continue
    return edges, completed


def append_checkpoint(page_id_str: str, edges: list[dict]):
    """Append one page's inferred edges to the JSONL checkpoint."""
    GRAPH_DIR.mkdir(parents=True, exist_ok=True)
    record = {"page_id": page_id_str, "edges": edges, "ts": date.today().isoformat()}
    with open(INFERRED_EDGES_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def build_inferred_edges(pages: list[Path], existing_edges: list[dict], cache: dict, resume: bool = True) -> list[dict]:
    """Pass 2: API-inferred semantic relationships with checkpoint/resume."""
    checkpoint_edges, completed_ids = ([], set())
    if resume:
        checkpoint_edges, completed_ids = load_checkpoint()
        if completed_ids:
            print(f"  checkpoint: {len(completed_ids)} pages already done, {len(checkpoint_edges)} edges loaded")

    new_edges = list(checkpoint_edges)

    changed_pages = []
    for p in pages:
        content = read_file(p)
        h = sha256(content)
        pid = page_id(p)
        entry = cache.get(str(p))

        if pid in completed_ids:
            continue

        if isinstance(entry, dict) and entry.get("hash") == h:
            for rel in entry.get("edges", []):
                rel_type = rel.get("type", "INFERRED")
                confidence = float(rel.get("confidence", 0.7))
                new_edges.append({
                    "id": edge_id(pid, rel["to"], rel_type),
                    "from": pid,
                    "to": rel["to"],
                    "type": rel_type,
                    "title": rel.get("relationship", ""),
                    "label": "",
                    "color": EDGE_COLORS.get(rel_type, EDGE_COLORS["INFERRED"]),
                    "confidence": confidence,
                })
        else:
            changed_pages.append(p)

    if not changed_pages:
        print("  no changed pages — skipping semantic inference")
        return new_edges

    total_pages = len(changed_pages)
    already_done = len(completed_ids)
    grand_total = total_pages + already_done
    print(f"  inferring relationships for {total_pages} remaining pages (of {grand_total} total)...")

    node_list = "\n".join(f"- {page_id(p)} ({extract_frontmatter_type(read_file(p))})" for p in pages)

    for i, p in enumerate(changed_pages, 1):
        full_content = read_file(p)
        content = full_content[:2000]
        src = page_id(p)
        global_idx = already_done + i
        print(f"    [{global_idx}/{grand_total}] Inferring for '{src}'... ", end="", flush=True)

        edges_for_page = [e for e in existing_edges if e.get("from") == src or e.get("from", "").endswith(src)]
        existing_edge_summary = "\n".join(
            f"- {e['from']} -> {e['to']} ({e.get('type', 'EXTRACTED')})"
            for e in edges_for_page
        ) if edges_for_page else "(none)"

        prompt = f"""Analyze this wiki page and identify implicit semantic relationships to other pages in the wiki.

Source page: {src}
Content:
{content}

All available pages:
{node_list}

Already-extracted edges from this page:
{existing_edge_summary}

Return ONLY a JSON object containing an "edges" array of NEW relationships not already captured by explicit wikilinks. The response must be STRICTLY valid JSON formatted exactly like this:
{{
  "edges": [
    {{"to": "page-id", "relationship": "one-line description", "confidence": 0.0-1.0, "type": "INFERRED or AMBIGUOUS"}}
  ]
}}

CRITICAL INSTRUCTION:
YOU MUST RETURN ONLY A RAW JSON STRING BEGINNING WITH {{ AND ENDING WITH }}.
DO NOT OUTPUT BULLET POINTS. DO NOT OUTPUT MARKDOWN LISTS.
ANY CONVERSATIONAL PREAMBLE WILL CAUSE A SYSTEM CRASH.

Rules:
- Only include pages from the available list above
- Confidence >= 0.7 → INFERRED, < 0.7 → AMBIGUOUS
- Do not repeat edges already in the extracted list
- Return {{"edges": []}} if no new relationships found
"""
        page_edges = []
        valid_rels = []
        try:
            raw = call_llm(prompt, "LLM_MODEL_FAST", "claude-3-5-haiku-latest", max_tokens=1024)
            if not raw:
                print("⚠  Empty LLM response")
                continue
            raw = raw.strip()

            match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", raw)
            if match:
                raw = match.group(0)
            else:
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)

            inferred = json.loads(raw)
            if isinstance(inferred, dict):
                edges_list = inferred.get("edges", [])
            elif isinstance(inferred, list):
                edges_list = inferred
            else:
                edges_list = []

            for rel in edges_list:
                if isinstance(rel, dict) and "to" in rel:
                    confidence = float(rel.get("confidence", 0.7))
                    rel_type = rel.get("type") or ("INFERRED" if confidence >= 0.7 else "AMBIGUOUS")
                    edge = {
                        "id": edge_id(src, rel["to"], rel_type),
                        "from": src,
                        "to": rel["to"],
                        "type": rel_type,
                        "title": rel.get("relationship", ""),
                        "label": "",
                        "color": EDGE_COLORS.get(rel_type, EDGE_COLORS["INFERRED"]),
                        "confidence": confidence,
                    }
                    page_edges.append(edge)
                    new_edges.append(edge)
                    valid_rels.append({
                        "to": rel["to"],
                        "relationship": rel.get("relationship", ""),
                        "confidence": confidence,
                        "type": rel_type,
                    })

            cache[str(p)] = {
                "hash": sha256(full_content),
                "edges": valid_rels,
            }
            append_checkpoint(src, page_edges)
            print(f"-> Found {len(page_edges)} edges.")
        except (json.JSONDecodeError, TypeError, ValueError) as jde:
            print(f"-> [WARN] Invalid JSON: {str(jde)[:60]}")
        except Exception as e:
            err_msg = str(e).replace('\n', ' ')[:80]
            print(f"-> [ERROR] {err_msg}")

    return new_edges


def deduplicate_edges(edges: list[dict]) -> list[dict]:
    """Merge duplicate edges (same from→to pair) keeping highest confidence.

    Uses (from, to, type) as key to preserve directionality.
    """
    best: dict[str, dict] = {}  # "from->to:type" -> best edge

    for e in edges:
        from_id = e["from"]
        to_id = e["to"]
        etype = e.get("type", "INFERRED")

        # Primary key: exact direction + type
        key = f"{from_id}->{to_id}:{etype}"
        existing = best.get(key)
        if not existing or e.get("confidence", 0) > existing.get("confidence", 0):
            best[key] = e

    deduped = []
    for edge in best.values():
        rel_type = edge.get("type", "INFERRED")
        edge["id"] = edge.get("id", edge_id(edge["from"], edge["to"], rel_type))
        edge["color"] = edge.get("color", EDGE_COLORS.get(rel_type, EDGE_COLORS["INFERRED"]))
        edge["confidence"] = float(edge.get("confidence", 0.7 if rel_type != "EXTRACTED" else 1.0))
        edge.setdefault("title", "")
        edge.setdefault("label", "")
        deduped.append(edge)
    return deduped


def detect_communities(nodes: list[dict], edges: list[dict]) -> dict[str, int]:
    """Assign community IDs to nodes using Louvain algorithm."""
    if not HAS_NETWORKX:
        return {}

    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for e in edges:
        G.add_edge(e["from"], e["to"])

    if G.number_of_edges() == 0:
        return {}

    try:
        communities = nx_community.louvain_communities(G, seed=42)
        node_to_community = {}
        for i, comm in enumerate(communities):
            for node in comm:
                node_to_community[node] = i
        return node_to_community
    except Exception:
        return {}


def find_phantom_hubs(pages: list[Path], min_refs: int = 2) -> list[dict]:
    """Find wikilinks referenced by multiple pages but pointing to non-existent pages.

    These are strong signals for pages that should be created next.
    Returns list of dicts with 'name', 'ref_count', and 'referenced_by' keys,
    sorted by ref_count descending.
    """
    existing_stems = {p.stem.lower() for p in pages}
    # Count how many distinct pages reference each missing target
    refs: dict[str, set[str]] = {}  # target_name -> set of source page_ids
    for p in pages:
        content = read_file(p)
        links = extract_wikilinks(content)
        src = page_id(p)
        for link in links:
            # Handle [[PageName|display alias]] format
            link_target = link.split("|")[0].strip()
            if link_target.lower() not in existing_stems:
                refs.setdefault(link_target, set()).add(src)

    phantoms = [
        {
            "name": name,
            "ref_count": len(sources),
            "referenced_by": sorted(sources),
        }
        for name, sources in refs.items()
        if len(sources) >= min_refs
    ]
    phantoms.sort(key=lambda x: x["ref_count"], reverse=True)
    return phantoms


def generate_report(nodes: list[dict], edges: list[dict], communities: dict[str, int],
                    pages: list[Path] | None = None) -> str:
    """Generate a structured graph health report.

    Analyzes the graph for orphan nodes, hub pages (god nodes),
    fragile inter-community bridges, phantom hubs (referenced but
    non-existent pages), and overall connectivity health.
    """
    today = date.today().isoformat()
    n_nodes = len(nodes)
    n_edges = len(edges)

    if n_nodes == 0:
        return f"# Graph Insights Report — {today}\n\nWiki is empty — nothing to report.\n"

    # Build NetworkX graph for analysis
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for e in edges:
        G.add_edge(e["from"], e["to"])

    # --- Metrics ---
    degrees = dict(G.degree())
    edges_per_node = n_edges / n_nodes if n_nodes else 0
    density = nx.density(G)

    # Health rating
    if edges_per_node >= 2.0:
        health = "✅ healthy"
    elif edges_per_node >= 1.0:
        health = "⚠️ warning"
    else:
        health = "🔴 critical"

    # Orphans: degree == 0
    orphans = sorted([n for n, d in degrees.items() if d == 0])
    orphan_count = len(orphans)
    orphan_pct = (orphan_count / n_nodes * 100) if n_nodes else 0

    # God nodes: degree > mean + 2*std
    deg_values = list(degrees.values())
    mean_deg = statistics.mean(deg_values) if deg_values else 0
    std_deg = statistics.stdev(deg_values) if len(deg_values) > 1 else 0
    god_threshold = mean_deg + 2 * std_deg
    god_nodes = sorted(
        [(n, d) for n, d in degrees.items() if d > god_threshold],
        key=lambda x: x[1],
        reverse=True,
    )

    # Community stats
    community_count = len(set(communities.values())) if communities else 0
    comm_members: dict[int, list[str]] = {}
    for node_id, comm_id in communities.items():
        comm_members.setdefault(comm_id, []).append(node_id)

    # Fragile bridges: community pairs connected by exactly 1 edge
    cross_comm_edges: dict[tuple[int, int], list[dict]] = {}
    for e in edges:
        ca = communities.get(e["from"], -1)
        cb = communities.get(e["to"], -1)
        if ca >= 0 and cb >= 0 and ca != cb:
            key = (min(ca, cb), max(ca, cb))
            cross_comm_edges.setdefault(key, []).append(e)
    fragile_bridges = [
        (pair, edge_list[0])
        for pair, edge_list in sorted(cross_comm_edges.items())
        if len(edge_list) == 1
    ]

    # --- Build report ---
    lines = [
        f"# Graph Insights Report — {today}",
        "",
        "## Health Summary",
        f"- **{n_nodes}** nodes, **{n_edges}** edges ({edges_per_node:.2f} edges/node — {health})",
        f"- **{orphan_count}** orphan nodes ({orphan_pct:.1f}%) — target: <10%",
        f"- **{community_count}** communities",
        f"- Link density: {density:.4f}",
        "",
    ]

    # Orphan section
    lines.append(f"## 🔴 Orphan Nodes ({orphan_count} pages, {orphan_pct:.1f}%)")
    if orphans:
        lines.append("These pages have zero graph connections. Consider adding [[wikilinks]]:")
        for o in orphans:
            lines.append(f"- `{o}`")
    else:
        lines.append("No orphan nodes — excellent!")
    lines.append("")

    # God nodes section
    lines.append("## 🟡 God Nodes (Hub Pages)")
    if god_nodes:
        lines.append("These nodes carry disproportionate connectivity (degree > μ+2σ). Verify they are comprehensive:")
        lines.append("")
        lines.append("| Node | Degree | % of Edges | Community |")
        lines.append("|---|---|---|---|")
        for node_id, deg in god_nodes:
            edge_pct = (deg / (2 * n_edges) * 100) if n_edges else 0
            comm = communities.get(node_id, -1)
            lines.append(f"| `{node_id}` | {deg} | {edge_pct:.1f}% | {comm} |")
    else:
        lines.append("No god nodes detected — degree distribution is balanced.")
    lines.append("")

    # Fragile bridges section
    lines.append("## 🟡 Fragile Bridges")
    if fragile_bridges:
        lines.append("Community pairs connected by only 1 edge — one deleted link breaks them:")
        for (ca, cb), edge in fragile_bridges:
            lines.append(f"- Community {ca} ↔ Community {cb} via `{edge['from']}` → `{edge['to']}`")
    else:
        lines.append("No fragile bridges — all community connections are redundant.")
    lines.append("")

    # Community overview
    lines.append("## 🟢 Community Overview")
    if comm_members:
        lines.append("")
        lines.append("| Community | Nodes | Key Members |")
        lines.append("|---|---|---|")
        for comm_id in sorted(comm_members.keys()):
            members = comm_members[comm_id]
            # Sort by degree descending to show key members first
            members_sorted = sorted(members, key=lambda m: degrees.get(m, 0), reverse=True)
            key_members = ", ".join(members_sorted[:5])
            if len(members_sorted) > 5:
                key_members += ", …"
            lines.append(f"| {comm_id} | {len(members)} | {key_members} |")
    else:
        lines.append("No communities detected.")
    lines.append("")

    # Suggested actions
    # Phantom hubs section
    phantoms = find_phantom_hubs(pages) if pages else []
    lines.append("## 🟠 Phantom Hubs (referenced but non-existent pages)")
    if phantoms:
        lines.append("These pages are referenced by 2+ existing pages but don't exist yet.")
        lines.append("They represent strong page creation signals — prioritize by reference count:")
        lines.append("")
        lines.append("| Page Name | References | Referenced By |")
        lines.append("|---|---|---|")
        for ph in phantoms:
            refs_preview = ", ".join(ph["referenced_by"][:3])
            if len(ph["referenced_by"]) > 3:
                refs_preview += ", …"
            lines.append(f"| `[[{ph['name']}]]` | {ph['ref_count']} | {refs_preview} |")
    elif pages:
        lines.append("No phantom hubs — all referenced pages exist.")
    else:
        lines.append("Phantom hub detection skipped (no page data available).")
    lines.append("")

    lines.append("## Suggested Actions")
    actions = []
    if orphans:
        actions.append(f"1. Add wikilinks to top orphan pages (highest potential impact: {orphans[0]})")
    if god_nodes:
        actions.append(f"{len(actions)+1}. Review god nodes for stub content vs. genuine hubs")
    if fragile_bridges:
        actions.append(f"{len(actions)+1}. Strengthen fragile bridges with cross-references")
    if phantoms:
        actions.append(f"{len(actions)+1}. Create pages for top phantom hubs (start with `[[{phantoms[0]['name']}]]` — {phantoms[0]['ref_count']} references)")
    if not actions:
        actions.append("1. Graph is in good shape — maintain current linking practices")
    lines.extend(actions)
    lines.append("")

    return "\n".join(lines)


COMMUNITY_COLORS = [
    "#E91E63", "#00BCD4", "#8BC34A", "#FF5722", "#673AB7",
    "#FFC107", "#009688", "#F44336", "#3F51B5", "#CDDC39",
]



def build_graph(infer: bool = True, open_browser: bool = False, clean: bool = False,
                report: bool = False, save: bool = False):
    pages = list(all_wiki_pages())
    today = date.today().isoformat()

    if not pages:
        print("Wiki is empty. Ingest some sources first.")
        return

    print(f"Building graph from {len(pages)} wiki pages...")
    GRAPH_DIR.mkdir(parents=True, exist_ok=True)

    # Clean checkpoint if requested
    if clean and INFERRED_EDGES_FILE.exists():
        INFERRED_EDGES_FILE.unlink()
        print("  cleaned: removed inference checkpoint")

    cache = load_cache()

    # Pass 1: extracted edges
    print("  Pass 1: extracting wikilinks...")
    nodes = build_nodes(pages)
    edges = build_extracted_edges(pages)
    print(f"  → {len(edges)} extracted edges")

    # Pass 2: inferred edges
    if infer:
        print("  Pass 2: inferring semantic relationships...")
        inferred = build_inferred_edges(pages, edges, cache, resume=not clean)
        edges.extend(inferred)
        print(f"  → {len(inferred)} inferred edges")
        save_cache(cache)

    # Deduplicate edges
    before_dedup = len(edges)
    edges = deduplicate_edges(edges)
    if before_dedup != len(edges):
        print(f"  dedup: {before_dedup} → {len(edges)} edges")

    # Community detection
    print("  Running Louvain community detection...")
    communities = detect_communities(nodes, edges)
    for node in nodes:
        comm_id = communities.get(node["id"], -1)
        if comm_id >= 0:
            node["color"] = COMMUNITY_COLORS[comm_id % len(COMMUNITY_COLORS)]
        node["group"] = comm_id

    # Compute degree-based node sizing (value) for vis.js scaling
    degree_map: dict[str, int] = {}
    for e in edges:
        degree_map[e["from"]] = degree_map.get(e["from"], 0) + 1
        degree_map[e["to"]] = degree_map.get(e["to"], 0) + 1
    for node in nodes:
        node["value"] = degree_map.get(node["id"], 0) + 1  # +1 so isolated nodes are still visible

    # Save graph.json
    graph_data = {"nodes": nodes, "edges": edges, "built": today}
    GRAPH_JSON.write_text(json.dumps(graph_data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  saved: graph/graph.json  ({len(nodes)} nodes, {len(edges)} edges)")

    # Save graph.html
    html = render_html(nodes, edges)
    GRAPH_HTML.write_text(html, encoding="utf-8")
    print(f"  saved: graph/graph.html")

    n_ext = len([e for e in edges if e['type']=='EXTRACTED'])
    n_inf = len([e for e in edges if e['type'] in ('INFERRED', 'AMBIGUOUS')])
    append_log(f"## [{today}] graph | Knowledge graph rebuilt\n\n{len(nodes)} nodes, {len(edges)} edges ({n_ext} extracted, {n_inf} inferred).")

    # Generate health report
    if report:
        if not HAS_NETWORKX:
            print("Warning: networkx not installed. Cannot generate report.")
        else:
            report_text = generate_report(nodes, edges, communities, pages=pages)
            print("\n" + report_text)
            if save:
                report_path = GRAPH_DIR / "graph-report.md"
                report_path.write_text(report_text, encoding="utf-8")
                print(f"  saved: {report_path.relative_to(REPO_ROOT)}")
            append_log(f"## [{today}] report | Graph health report generated\n\n{len(nodes)} nodes analyzed.")

    if open_browser:
        webbrowser.open(f"file://{GRAPH_HTML.resolve()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build LLM Wiki knowledge graph")
    parser.add_argument("--no-infer", action="store_true", help="Skip semantic inference (faster)")
    parser.add_argument("--open", action="store_true", help="Open graph.html in browser")
    parser.add_argument("--clean", action="store_true", help="Delete checkpoint and force full re-inference")
    parser.add_argument("--report", action="store_true", help="Generate graph health report")
    parser.add_argument("--save", action="store_true", help="Save report to graph/graph-report.md")
    args = parser.parse_args()
    build_graph(infer=not args.no_infer, open_browser=args.open, clean=args.clean,
                report=args.report, save=args.save)
