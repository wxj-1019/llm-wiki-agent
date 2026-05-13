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
import tempfile
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

try:
    from tools.shared.logging_config import get_logger
    logger = get_logger("heal")
except ImportError:
    import logging
    logger = logging.getLogger("wiki.heal")


# ── Shared utilities (with inline fallback) ─────────────────────────
try:
    from tools.shared.wiki import read_file
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, str(path))
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


try:
    from tools.shared.llm import _load_llm_config, call_llm, LLMUnavailableError
except ImportError:
    # If shared.llm is not available, provide minimal stubs that fail clearly
    class LLMUnavailableError(Exception):
        """LLM is not available — litellm or shared.llm not installed."""
        pass

    def _load_llm_config() -> dict:
        cfg_path = REPO_ROOT / "config" / "llm.yaml"
        defaults = {
            "provider": "anthropic",
            "model": os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest"),
        }
        if cfg_path.exists():
            try:
                import yaml
                data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
                return {**defaults, **data}
            except Exception:
                pass
        return defaults

    def call_llm(prompt: str, **kwargs) -> str:
        try:
            import litellm
        except ImportError as exc:
            raise LLMUnavailableError("litellm not installed. Run: pip install litellm") from exc
        cfg = _load_llm_config()
        model = kwargs.get("model", os.getenv("LLM_MODEL", cfg.get("model", "claude-3-5-sonnet-latest")))
        max_tokens = kwargs.get("max_tokens", 1500)
        resp = litellm.completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content


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
    _atomic_write(INDEX_FILE, content)


def heal_missing_entities(dry_run: bool = False):
    pages = list(all_wiki_pages())
    missing_entities = find_missing_entities(pages)
    logger.info("Heal start | dry_run=%s total_pages=%d missing_entities=%d", dry_run, len(pages), len(missing_entities))

    if not missing_entities:
        print("Graph is fully connected. No missing entities found!")
        logger.info("No missing entities found")
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
    failed = []
    for entity in missing_entities:
        print(f"Healing entity page for: {entity}")
        sources = search_sources(entity, pages)
        logger.info("Healing entity | entity=%s sources=%d", entity, len(sources))

        context = ""
        for s in sources:
            context += f"\n\n### {s.name}\n{s.read_text(encoding='utf-8')[:800]}"

        safe_entity_name = entity.replace('\\', '\\\\').replace('"', '\\"')
        source_names = ", ".join(s.name for s in sources)
        prompt = f"""You are filling a data gap in the Personal LLM Wiki.
Create an Entity definition page for "{safe_entity_name}".

Here is how the entity appears in the current sources:
{context}

Format:
---
title: "{safe_entity_name}"
type: entity
tags: []
sources: [{source_names}]
---

# {safe_entity_name}

Write a comprehensive paragraph defining what `{safe_entity_name}` means in the context of this wiki, its main significance, and any actions or associations related to it.
"""
        try:
            result = call_llm(prompt)
            safe_entity = Path(entity).name
            if not safe_entity or safe_entity in (".", ".."):
                print(f" [!] Skipping invalid entity name: {entity!r}")
                logger.warning("Skipping invalid entity name | entity=%r", entity)
                continue
            normalized = re.sub(r'[\\/:*?"<>|]', '', safe_entity)
            normalized = normalized.replace(" ", "").replace("-", "")
            # Guard against empty filename after normalization (e.g., entity was only spaces/hyphens)
            if not normalized:
                print(f" [!] Skipping entity — name becomes empty after sanitization: {entity!r}")
                logger.warning("Skipping empty-normalized entity | entity=%r", entity)
                continue
            legacy_path = ENTITIES_DIR / f"{safe_entity}.md"
            out_path = ENTITIES_DIR / f"{normalized}.md"
            if legacy_path.exists() and not out_path.exists():
                out_path = legacy_path
            _atomic_write(out_path, result)
            print(f" -> Saved to {out_path.relative_to(REPO_ROOT)}")
            logger.info("Entity page created | entity=%s path=%s chars=%d", entity, out_path.relative_to(REPO_ROOT), len(result))
            created.append((safe_entity, out_path.stem))
        except Exception as e:
            print(f" [!] Failed to generate {entity}: {e}")
            logger.error("Entity page generation failed | entity=%s error_type=%s error=%s", entity, type(e).__name__, e)
            failed.append(entity)

    # Update index with newly created entities
    if created:
        today = date.today().isoformat()
        entries = [f"- [{display}](entities/{stem}.md) — auto-healed entity" for display, stem in created]
        update_index(entries)
        print(f"  indexed: {len(entries)} entity page(s)")
        logger.info("Index updated | new_entities=%d", len(entries))

        try:
            from tools.shared.wiki import normalize_wikilinks
            canonical_map = {}
            for p in all_wiki_pages():
                stem = p.stem
                canonical_map[stem.lower()] = stem
                canonical_map[stem.lower().replace(" ", "").replace("-", "")] = stem
            normalized_count = 0
            for p in all_wiki_pages():
                c = p.read_text(encoding="utf-8")
                nc = normalize_wikilinks(c, canonical_map)
                if nc != c:
                    _atomic_write(p, nc)
                    normalized_count += 1
            if normalized_count:
                logger.info("Wikilinks normalized | pages_updated=%d", normalized_count)
        except ImportError:
            logger.warning("Wikilink normalization skipped — shared.wiki module not available")

        names = ", ".join(display for display, _ in created)
        append_log(f"## [{today}] heal | Auto-healed missing entities\n\nCreated entity pages for: {names}.")

    logger.info("Heal complete | created=%d failed=%d total_missing=%d",
                len(created), len(failed), len(missing_entities))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto-heal missing entity pages in the wiki")
    parser.add_argument("--dry-run", action="store_true",
                        help="List missing entities without generating pages")
    args = parser.parse_args()
    heal_missing_entities(dry_run=args.dry_run)
