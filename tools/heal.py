#!/usr/bin/env python3
"""
Graph Self-Healing Tool

Automatically retrieves "Missing Entity Pages" from the wiki and generates 
comprehensive definition pages for them using the LLM. 
It resolves broken entity links by scanning existing contexts where the entity is referenced.

Usage:
    python tools/heal.py
    python tools/heal.py --dry-run
"""

from __future__ import annotations

import os
import re
import sys
import argparse
from pathlib import Path
from datetime import date

# Ensure tools can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.lint import find_missing_entities, all_wiki_pages

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
ENTITIES_DIR = WIKI_DIR / "entities"
INDEX_FILE = WIKI_DIR / "index.md"
LOG_FILE = WIKI_DIR / "log.md"


# ── Shared utilities (with inline fallback) ─────────────────────────
try:
    from tools.shared.wiki import read_file
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""


try:
    from tools.shared.llm import _load_llm_config, call_llm, LLMUnavailableError
except ImportError:
    def _load_llm_config() -> dict:
        cfg_path = REPO_ROOT / "config" / "llm.yaml"
        defaults = {
            "provider": "anthropic",
            "model": "anthropic/claude-3-5-haiku-latest",
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

    def call_llm(prompt: str, max_tokens: int = 1500, model_env: str = "LLM_MODEL", default_model: str = "anthropic/claude-3-5-haiku-latest", max_retries: int = 2, timeout: int = 120) -> str:
        try:
            from litellm import completion
        except ImportError as exc:
            raise LLMUnavailableError("litellm not installed") from exc

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
            "timeout": timeout,
        }
        if api_key:
            kwargs["api_key"] = api_key

        last_err = None
        for attempt in range(max_retries + 1):
            try:
                response = completion(**kwargs)
                return response.choices[0].message.content
            except Exception as e:
                last_err = e
                if attempt < max_retries:
                    import time
                    time.sleep(2 ** attempt)
        raise last_err


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


def search_sources(entity: str, pages: list[Path]) -> list[Path]:
    """Find up to 15 pages where this entity is mentioned natively."""
    if len(entity) < 2:
        return []
    sources = []
    entity_lower = entity.lower()
    pattern = re.compile(rf'\[\[{re.escape(entity)}\]\]', re.IGNORECASE)
    for p in pages:
        parent_name = p.parent.name.lower()
        if parent_name not in ("entities", "concepts"):
            content = p.read_text(encoding="utf-8")
            if pattern.search(content):
                sources.append(p)
    return sources[:15]


def update_index(entries: list[str]) -> None:
    """Add entity entries to index.md under ## Entities section."""
    content = read_file(INDEX_FILE)
    if not content:
        content = (
            "# Wiki Index\n\n"
            "## Overview\n"
            "- [Overview](overview.md) — living synthesis\n\n"
            "## Sources\n\n"
            "## Entities\n\n"
            "## Concepts\n\n"
            "## Syntheses\n"
        )
    for entry in entries:
        if entry.strip() in content:
            continue
        section_header = "## Entities"
        if section_header in content:
            content = content.replace(section_header + "\n", section_header + "\n" + entry + "\n")
        else:
            content += f"\n{section_header}\n{entry}\n"
    INDEX_FILE.write_text(content, encoding="utf-8")


def heal_missing_entities(dry_run: bool = False):
    pages = list(all_wiki_pages())
    missing_entities = find_missing_entities(pages)

    if not missing_entities:
        print("Graph is fully connected. No missing entities found!")
        return

    if dry_run:
        print(f"Found {len(missing_entities)} missing entity nodes (dry-run, no changes):\n")
        for entity in missing_entities:
            sources = search_sources(entity, pages)
            source_names = ", ".join(s.name for s in sources[:5])
            if len(sources) > 5:
                source_names += f" and {len(sources) - 5} more"
            print(f"  - [[{entity}]] — referenced in {len(sources)} page(s) ({source_names})")
        print(f"\nRun without --dry-run to generate entity pages.")
        return

    try:
        from litellm import completion
    except ImportError:
        print(f"Found {len(missing_entities)} missing entity nodes:")
        for entity in missing_entities:
            print(f"  - [[{entity}]]")
        print("\n[SKIP] Cannot generate pages — litellm not installed. Run: pip install litellm")
        return

    ENTITIES_DIR.mkdir(exist_ok=True, parents=True)
    print(f"Found {len(missing_entities)} missing entity nodes. Commencing auto-heal...")

    created = []
    for entity in missing_entities:
        print(f"Healing entity page for: {entity}")
        sources = search_sources(entity, pages)

        context = ""
        for s in sources:
            context += f"\n\n### {s.name}\n{s.read_text(encoding='utf-8')[:800]}"

        prompt = f"""You are filling a data gap in the Personal LLM Wiki.
Create an Entity definition page for "{entity}".

Here is how the entity appears in the current sources:
{context}

Format:
---
title: "{entity}"
type: entity
tags: []
sources: {[s.name for s in sources]}
---

# {entity}

Write a comprehensive paragraph defining what `{entity}` means in the context of this wiki, its main significance, and any actions or associations related to it.
"""
        try:
            result = call_llm(prompt)
            safe_entity = Path(entity).name
            if not safe_entity or safe_entity in (".", ".."):
                print(f" [!] Skipping invalid entity name: {entity!r}")
                continue
            out_path = ENTITIES_DIR / f"{safe_entity}.md"
            out_path.write_text(result, encoding="utf-8")
            print(f" -> Saved to {out_path.relative_to(REPO_ROOT)}")
            created.append(entity)
        except Exception as e:
            print(f" [!] Failed to generate {entity}: {e}")

    # Update index with newly created entities
    if created:
        today = date.today().isoformat()
        entries = [f"- [{e}](entities/{e}.md) — auto-healed entity" for e in created]
        update_index(entries)
        print(f"  indexed: {len(entries)} entity page(s)")

        names = ", ".join(created)
        append_log(f"## [{today}] heal | Auto-healed missing entities\n\nCreated entity pages for: {names}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto-heal missing entity pages in the wiki")
    parser.add_argument("--dry-run", action="store_true",
                        help="List missing entities without generating pages")
    args = parser.parse_args()
    heal_missing_entities(dry_run=args.dry_run)
