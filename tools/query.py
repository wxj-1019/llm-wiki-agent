#!/usr/bin/env python3
"""
Query the LLM Wiki.

Usage:
    python tools/query.py "What are the main themes across all sources?"
    python tools/query.py "How does ConceptA relate to ConceptB?" --save
    python tools/query.py "Summarize everything about EntityName" --save synthesis/my-analysis.md

Flags:
    --save              Save the answer back into the wiki (prompts for filename)
    --save <path>       Save to a specific wiki path
"""

import sys
import re
import json
import argparse
from pathlib import Path
from datetime import date

import os

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
INDEX_FILE = WIKI_DIR / "index.md"
LOG_FILE = WIKI_DIR / "log.md"
SCHEMA_FILE = REPO_ROOT / "CLAUDE.md"


# ── Shared utilities (with inline fallback) ─────────────────────────
try:
    from tools.shared.wiki import read_file, write_file
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def write_file(path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"  saved: {path.relative_to(REPO_ROOT)}")

# ── Shared path safety (with inline fallback) ──
try:
    from tools.shared.paths import sanitize_wiki_path
except ImportError:
    def sanitize_wiki_path(path_str: str, base_dir: Path) -> Path:
        if not path_str or path_str in (".", ".."):
            raise ValueError(f"Invalid path: {path_str!r}")
        path_str = path_str.lstrip("/\\")
        target = (base_dir / path_str).resolve()
        base = base_dir.resolve()
        try:
            target.relative_to(base)
        except ValueError:
            raise ValueError(f"Path traversal blocked: {path_str!r}")
        return target





# ── Shared LLM utilities (with inline fallback) ──
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
            sys.exit(1)

        cfg = _load_llm_config()
        model = cfg.get("model") or os.getenv(model_env, default_model)
        provider = cfg.get("provider", "anthropic")
        if "/" not in model:
            model = f"{provider}/{model}"
        api_key = cfg.get("api_key", "")

        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens
        }
        if api_key:
            kwargs["api_key"] = api_key

        response = completion(**kwargs)
        return response.choices[0].message.content


def find_relevant_pages(question: str, index_content: str) -> list[Path]:
    """Extract linked pages from index that seem relevant to the question.
    Uses character-level matching for CJK compatibility."""
    md_links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', index_content)
    question_lower = question.lower()
    relevant = []

    for title, href in md_links:
        title_lower = title.lower()
        # For CJK: check if any 2+ char substring of the title appears in question
        # Covers CJK Unified Ideographs (U+4E00-U+9FFF) + Extension A (U+3400-U+4DBF)
        has_cjk = any(
            '\u3400' <= ch <= '\u4dbf' or '\u4e00' <= ch <= '\u9fff'
            for ch in title
        )
        if has_cjk:
            # Sliding window: check if any 2-char CJK bigram from title exists in question
            matched = any(
                title_lower[j:j+2] in question_lower
                for j in range(len(title_lower) - 1)
                if any(
                    '\u3400' <= c <= '\u4dbf' or '\u4e00' <= c <= '\u9fff'
                    for c in title_lower[j:j+2]
                )
            )
        else:
            # Latin: original word-based match (lowered threshold to >2)
            matched = any(word in question_lower for word in title_lower.split() if len(word) > 2)

        if matched:
            p = (WIKI_DIR / href).resolve()
            if p.exists() and str(p).startswith(str(WIKI_DIR.resolve())) and p not in relevant:
                relevant.append(p)

    # Also try graph-based expansion: find neighbors of matched pages
    graph_json = REPO_ROOT / "graph" / "graph.json"
    if graph_json.exists() and relevant:
        try:
            graph_data = json.loads(graph_json.read_text(encoding="utf-8"))
            page_ids = {p.relative_to(WIKI_DIR).as_posix().replace('.md', '') for p in relevant}
            neighbors = set()
            for edge in graph_data.get('edges', []):
                if edge.get('confidence', 0) >= 0.7:
                    if edge['from'] in page_ids:
                        neighbors.add(edge['to'])
                    elif edge['to'] in page_ids:
                        neighbors.add(edge['from'])
            for nid in neighbors:
                np = WIKI_DIR / f"{nid}.md"
                if np.exists():
                    np_resolved = np.resolve()
                    if not any(np_resolved == r.resolve() for r in relevant):
                        relevant.append(np)
        except (json.JSONDecodeError, KeyError):
            pass

    # Always include overview
    overview = WIKI_DIR / "overview.md"
    if overview.exists() and overview not in relevant:
        relevant.insert(0, overview)
    return relevant[:15]  # cap to avoid context overflow


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


def query(question: str, save_path: str | None = None):
    today = date.today().isoformat()

    # Step 1: Read index
    index_content = read_file(INDEX_FILE)
    if not index_content:
        print("Wiki is empty. Ingest some sources first with: python tools/ingest.py <source>")
        sys.exit(1)

    # Step 2: Find relevant pages
    relevant_pages = find_relevant_pages(question, index_content)

    # If no keyword match, ask Claude to identify relevant pages from the index
    if not relevant_pages or len(relevant_pages) <= 1:
        print("  selecting relevant pages via API...")
        prompt = f"Given this wiki index:\n\n{index_content}\n\nWhich pages are most relevant to answering: \"{question}\"\n\nReturn ONLY a JSON array of relative file paths (as listed in the index), e.g. [\"sources/foo.md\", \"concepts/Bar.md\"]. Maximum 10 pages."
        raw = call_llm(prompt, "LLM_MODEL_FAST", "claude-3-5-haiku-latest", max_tokens=512)
        raw = raw.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        try:
            paths = json.loads(raw)
            relevant_pages = [WIKI_DIR / p for p in paths if (WIKI_DIR / p).exists()]
        except (json.JSONDecodeError, TypeError):
            pass

    # Step 3: Read relevant pages
    pages_context = ""
    for p in relevant_pages:
        rel = p.relative_to(REPO_ROOT)
        pages_context += f"\n\n### {rel}\n{p.read_text(encoding='utf-8')}"

    if not pages_context:
        pages_context = f"\n\n### wiki/index.md\n{index_content}"

    schema = read_file(SCHEMA_FILE)

    # Step 4: Synthesize answer
    print(f"  synthesizing answer from {len(relevant_pages)} pages...")
    prompt = f"""You are querying an LLM Wiki to answer a question. Use the wiki pages below to synthesize a thorough answer. Cite sources using [[PageName]] wikilink syntax.

Schema:
{schema}

Wiki pages:
{pages_context}

Question: {question}

Write a well-structured markdown answer with headers, bullets, and [[wikilink]] citations. At the end, add a ## Sources section listing the pages you drew from.
"""
    answer = call_llm(prompt, "LLM_MODEL", "claude-3-5-sonnet-latest", max_tokens=4096)
    print("\n" + "=" * 60)
    print(answer)
    print("=" * 60)

    # Step 5: Optionally save answer
    if save_path is not None:
        if save_path == "":
            # Prompt for filename (skip in non-TTY environments)
            if not sys.stdin.isatty():
                print("Non-interactive environment detected. Use --save <path> to save.")
                return
            slug = input("\nSave as (slug, e.g. 'my-analysis'): ").strip()
            if not slug:
                print("Skipping save.")
                return
            save_path = f"syntheses/{slug}.md"

        full_save_path = sanitize_wiki_path(save_path, WIKI_DIR)
        # Escape quotes in the question to avoid breaking YAML frontmatter
        safe_title = question[:80].replace('"', '\\"')
        frontmatter = f"""---
title: "{safe_title}"
type: synthesis
tags: []
sources: []
last_updated: {today}
---

"""
        write_file(full_save_path, frontmatter + answer)

        # Update index
        index_content = read_file(INDEX_FILE)
        entry = f"- [{question[:60]}]({save_path}) — synthesis"
        if "## Syntheses" in index_content:
            index_content = index_content.replace("## Syntheses\n", f"## Syntheses\n{entry}\n")
            INDEX_FILE.write_text(index_content, encoding="utf-8")
        print(f"  indexed: {save_path}")

    # Append to log
    append_log(f"## [{today}] query | {question[:80]}\n\nSynthesized answer from {len(relevant_pages)} pages." +
               (f" Saved to {save_path}." if save_path else ""))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Query the LLM Wiki")
    parser.add_argument("question", help="Question to ask the wiki")
    parser.add_argument("--save", nargs="?", const="", default=None,
                        help="Save answer to wiki (optionally specify path)")
    args = parser.parse_args()
    query(args.question, args.save)
