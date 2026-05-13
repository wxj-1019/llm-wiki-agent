#!/usr/bin/env python3
from __future__ import annotations

"""
Post-ingest reflection tool for LLM Wiki Agent.

Reads the latest ingest result from wiki/log.md, analyzes the processing
pattern, and updates wiki/.agent/MEMORY.md with learnings. Optionally
suggests new skills to extract.

Usage:
    python tools/reflect.py                      # reflect on last ingest
    python tools/reflect.py --last 3             # reflect on last 3 ingests
    python tools/reflect.py --suggest-skills     # also suggest skill extraction
    python tools/reflect.py --dry-run            # preview changes without writing
"""

import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
AGENT_DIR = WIKI_DIR / ".agent"
MEMORY_FILE = AGENT_DIR / "MEMORY.md"
LOG_FILE = WIKI_DIR / "log.md"
SOURCES_DIR = WIKI_DIR / "sources"

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    from tools.shared.llm import _load_llm_config, call_llm, LLMUnavailableError
except ImportError:
    import os

    def _load_llm_config() -> dict:
        cfg_path = REPO_ROOT / "config" / "llm.yaml"
        defaults = {
            "provider": "anthropic",
            "model": os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest"),
            "max_tokens": 4096,
            "temperature": 0.3,
        }
        if cfg_path.exists():
            try:
                import yaml
                with open(cfg_path, encoding="utf-8") as f:
                    user_cfg = yaml.safe_load(f) or {}
                defaults.update(user_cfg)
            except Exception:
                pass
        return defaults

    def call_llm(prompt: str, system: str = "", **kwargs) -> str:
        import litellm
        cfg = _load_llm_config()
        model = kwargs.get("model", cfg.get("model", "claude-3-5-sonnet-latest"))
        max_tokens = kwargs.get("max_tokens", cfg.get("max_tokens", 4096))
        temperature = kwargs.get("temperature", cfg.get("temperature", 0.3))
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = litellm.completion(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content

    class LLMUnavailableError(Exception):
        pass


def read_file(path: Path) -> str:
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def parse_log_entries(log_content: str, count: int = 1) -> list[dict]:
    entries = []
    pattern = re.compile(
        r"^## \[(\d{4}-\d{2}-\d{2})\]\s+(\w+)\s*\|\s*(.+)$",
        re.MULTILINE,
    )
    for m in pattern.finditer(log_content):
        entries.append({
            "date": m.group(1),
            "operation": m.group(2),
            "title": m.group(3).strip(),
        })
    return entries[-count:] if entries else []


def load_agent_context() -> str:
    parts = []
    for f in [MEMORY_FILE, AGENT_DIR / "USER.md"]:
        content = read_file(f)
        if content.strip():
            parts.append(f"--- {f.name} ---\n{content}")
    return "\n\n".join(parts)


def build_reflection_prompt(
    log_entries: list[dict],
    agent_context: str,
    source_summaries: list[str],
    suggest_skills: bool,
) -> str:
    entry_text = "\n".join(
        f"- [{e['date']}] {e['operation']} | {e['title']}" for e in log_entries
    )
    source_text = "\n\n".join(source_summaries) if source_summaries else "(No source pages found for recent ingests)"

    skill_instruction = ""
    if suggest_skills:
        skill_instruction = """
## Skill Extraction Analysis
If you notice a repeated processing pattern (e.g., a specific document format,
a recurring analysis structure, a domain-specific extraction approach), suggest
a reusable skill. Output:
- **skill_name**: kebab-case name
- **description**: what it does
- **trigger**: when to auto-apply it
- **template**: a Jinja2-compatible template outline
If no skill pattern is found, skip this section.
"""

    return f"""You are the reflection module for LLM Wiki Agent. Analyze recent
ingest operations and extract actionable learnings.

## Recent Log Entries
{entry_text}

## Source Page Summaries
{source_text}

## Current Agent Memory
{agent_context if agent_context else "(empty — first reflection)"}

## Your Task
1. **Pattern Recognition**: What document types, domains, or structures appeared?
2. **Quality Assessment**: Were there any issues (broken links, sparse pages, contradictions)?
3. **Learning Extraction**: What new knowledge or technique was applied?
4. **Memory Update**: Draft an updated MEMORY.md section — specifically the
   "Knowledge Organization Experience" and "Operation Log" sections.
   Keep it concise. Merge with existing content, don't duplicate.
{skill_instruction}
## Output Format
Respond with a JSON object:
```json
{{
  "patterns": ["pattern1", "pattern2"],
  "issues": ["issue1"],
  "learnings": ["learning1"],
  "memory_update": {{
    "knowledge_organization": "updated text to merge into this section",
    "operation_log": "one-line summary of this reflection cycle"
  }},
  "skill_suggestion": {{
    "name": "skill-name",
    "description": "...",
    "trigger": "...",
    "template_outline": "..."
  }}
}}
```
If no skill is suggested, set `skill_suggestion` to null.
"""


def _extract_key_phrases(text: str, min_len: int = 8) -> set[str]:
    """Extract normalized key phrases for dedup comparison."""
    import re as _re
    # Split on Chinese/English punctuation and line breaks
    phrases = _re.split(r"[；;。，,、\n•\-]", text)
    result: set[str] = set()
    for p in phrases:
        p = _re.sub(r"[^\w\u4e00-\u9fff]", "", p).strip().lower()
        if len(p) >= min_len:
            result.add(p)
    return result


def _is_duplicate_content(existing_section: str, new_content: str, threshold: float = 0.6) -> bool:
    """Check if new_content is semantically duplicated in existing_section.
    
    Returns True if enough key phrases from new_content already exist
    in existing_section (asymmetric phrase overlap >= threshold).
    """
    new_phrases = _extract_key_phrases(new_content)
    if not new_phrases:
        return False
    existing_phrases = _extract_key_phrases(existing_section)
    if not existing_phrases:
        return False
    intersection = new_phrases & existing_phrases
    # Asymmetric: what % of new phrases already exist
    overlap = len(intersection) / len(new_phrases)
    return overlap >= threshold


def merge_memory_section(
    existing: str, section_name: str, new_content: str
) -> str:
    """Merge new content into a named section, with semantic dedup.
    
    Only appends if the new content isn't already represented.
    Uses key-phrase overlap to detect semantic duplicates.
    """
    pattern = re.compile(
        rf"(## {re.escape(section_name)}\n)(.*?)(?=\n## |\Z)",
        re.DOTALL,
    )
    match = pattern.search(existing)
    if match:
        old_body = match.group(2).strip()
        # Check for semantic duplication
        if old_body and _is_duplicate_content(old_body, new_content):
            # Content already exists — skip append, return unchanged
            return existing
        # Not a duplicate — merge
        if old_body:
            merged = old_body.rstrip() + "\n- " + new_content.lstrip("- ")
        else:
            merged = "- " + new_content.lstrip("- ")
        return existing[: match.start(2)] + merged + "\n" + existing[match.end(2):]
    else:
        # Section doesn't exist yet — create it
        return existing.rstrip() + f"\n\n## {section_name}\n- {new_content}\n"


MEMORY_MAX_CHARS = 2200


def _trim_memory_if_needed(memory_text: str) -> str:
    """If MEMORY.md exceeds MEMORY_MAX_CHARS, truncate oldest entries."""
    if len(memory_text) <= MEMORY_MAX_CHARS:
        return memory_text
    
    # Strategy: keep frontmatter + first 2 sections intact,
    # trim the Operation Log to last 5 entries
    lines = memory_text.split("\n")
    frontmatter_end = 0
    in_frontmatter = False
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if not in_frontmatter:
                in_frontmatter = True
            else:
                frontmatter_end = i + 1
                break
    
    header = "\n".join(lines[:frontmatter_end])
    body = "\n".join(lines[frontmatter_end:])
    
    # If still too large, trim body proportionally
    while len(header) + len(body) > MEMORY_MAX_CHARS and len(body) > 200:
        # Remove oldest Operation Log entry
        op_log_marker = "## Operation Log"
        op_log_idx = body.find(op_log_marker)
        if op_log_idx >= 0:
            after_header = body[op_log_idx + len(op_log_marker):]
            entries = [e for e in after_header.strip().split("\n- [") if e.strip()]
            if len(entries) > 5:
                # Keep only last 5 entries
                kept = "\n- [" + "\n- [".join(entries[-5:])
                body = body[:op_log_idx + len(op_log_marker)] + kept
                continue
        # Fallback: cut body by 30%
        cut = int(len(body) * 0.7)
        body = body[:cut] + "\n\n> ... (older entries trimmed for token budget)\n"
        break
    
    return header + body


def update_memory_file(reflection: dict) -> str:
    existing = read_file(MEMORY_FILE)
    if not existing.strip():
        existing = """---
title: "Agent Memory"
type: agent
tags: [memory, agent]
last_updated: {today}
---

## Wiki Format Preferences

## Knowledge Organization Experience

## Operation Log
""".format(today=date.today().isoformat())

    mem_update = reflection.get("memory_update", {})
    if mem_update.get("knowledge_organization"):
        existing = merge_memory_section(
            existing,
            "Knowledge Organization Experience",
            mem_update["knowledge_organization"],
        )
    if mem_update.get("operation_log"):
        existing = merge_memory_section(
            existing,
            "Operation Log",
            f"[{date.today().isoformat()}] {mem_update['operation_log']}",
        )

    fm_pattern = re.compile(r"(last_updated:\s*)([\d-]+)")
    existing = fm_pattern.sub(rf"\g<1>{date.today().isoformat()}", existing)

    existing = _trim_memory_if_needed(existing)

    return existing


def run_reflection(
    last_n: int = 1,
    suggest_skills: bool = False,
    dry_run: bool = False,
) -> dict:
    log_content = read_file(LOG_FILE)
    if not log_content.strip():
        print("⚠  wiki/log.md is empty — nothing to reflect on.")
        return {}

    entries = parse_log_entries(log_content, count=last_n)
    if not entries:
        print("⚠  No log entries found.")
        return {}

    print(f"📝 Reflecting on {len(entries)} recent operation(s):")
    for e in entries:
        print(f"   [{e['date']}] {e['operation']} | {e['title']}")

    source_summaries = []
    for e in entries:
        if e["operation"] == "ingest":
            slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", e["title"].lower()).strip("-")
            for src_file in SOURCES_DIR.glob("*.md"):
                if slug and slug in src_file.stem.lower():
                    content = read_file(src_file)
                    summary_match = re.search(
                        r"## Summary\s*\n(.*?)(?=\n## |\Z)", content, re.DOTALL
                    )
                    if summary_match:
                        source_summaries.append(
                            f"Source: {src_file.stem}\n{summary_match.group(1).strip()}"
                        )
                    break

    agent_context = load_agent_context()

    prompt = build_reflection_prompt(
        entries, agent_context, source_summaries, suggest_skills
    )

    print("🤖 Calling LLM for reflection analysis...")
    try:
        response = call_llm(
            prompt,
            system="You are a knowledge management reflection engine. Respond only with valid JSON.",
            temperature=0.2,
            max_tokens=2048,
        )
    except LLMUnavailableError:
        print("⚠  LLM unavailable — skipping reflection.")
        return {}

    json_match = re.search(r"\{.*\}", response, re.DOTALL)
    if not json_match:
        print("⚠  Could not parse LLM response as JSON.")
        print(f"   Raw response: {response[:200]}")
        return {}

    try:
        reflection = json.loads(json_match.group())
    except json.JSONDecodeError:
        print("⚠  Invalid JSON in LLM response.")
        return {}

    print("\n🔍 Reflection Results:")
    if reflection.get("patterns"):
        print(f"   Patterns: {', '.join(reflection['patterns'])}")
    if reflection.get("issues"):
        print(f"   Issues: {', '.join(reflection['issues'])}")
    if reflection.get("learnings"):
        print(f"   Learnings: {', '.join(reflection['learnings'])}")
    if reflection.get("skill_suggestion"):
        sk = reflection["skill_suggestion"]
        print(f"   Suggested Skill: {sk['name']} — {sk['description']}")

    if dry_run:
        print("\n🏃 Dry run — no files modified.")
        return reflection

    updated_memory = update_memory_file(reflection)
    write_file(MEMORY_FILE, updated_memory)
    print(f"\n✅ Updated {MEMORY_FILE.relative_to(REPO_ROOT)}")

    if reflection.get("skill_suggestion") and suggest_skills:
        sk = reflection["skill_suggestion"]
        skills_dir = REPO_ROOT / "skills" / sk["name"]
        skills_dir.mkdir(parents=True, exist_ok=True)
        skill_md = f"""---
name: "{sk['name']}"
type: skill
auto_generated: true
source: reflect.py
created: {date.today().isoformat()}
---

# {sk['name']}

{sk.get('description', '')}

## Trigger
{sk.get('trigger', 'manual')}

## Template
```
{sk.get('template_outline', 'TODO')}
```
"""
        skill_path = skills_dir / "SKILL.md"
        write_file(skill_path, skill_md)
        print(f"💡 Created skill draft: {skill_path.relative_to(REPO_ROOT)}")

    return reflection


def suggest_templates(dry_run: bool = False) -> list[dict]:
    """Analyze successful ingestions and suggest templates for common patterns.

    Returns list of suggested templates with domain, confidence, and template content.
    """
    templates = []

    sources_dir = WIKI_DIR / "sources"
    if not sources_dir.exists():
        return templates

    tag_counts: dict[str, int] = {}
    tag_patterns: dict[str, list[str]] = {}

    for md_file in sources_dir.glob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8")[:2000]
            if content.startswith("---"):
                end_idx = content.find("\n---", 3)
                if end_idx > 0:
                    block = content[3:end_idx]
                    for line in block.split("\n"):
                        line_s = line.strip()
                        if line_s.startswith("tags:"):
                            tag_str = line_s[5:].strip().strip("[]")
                            for tag in tag_str.split(","):
                                tag = tag.strip().strip('"').strip("'")
                                if tag:
                                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
                                    tag_patterns.setdefault(tag, []).append(md_file.stem)
        except (OSError, UnicodeDecodeError):
            continue

    for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
        if count >= 3:
            confidence = min(0.95, 0.5 + count * 0.05)
            templates.append({
                "domain": tag,
                "confidence": round(confidence, 2),
                "sample_count": count,
                "samples": tag_patterns[tag][:5],
                "suggestion": f"Consider creating a template for '{tag}' domain ({count} similar sources found)",
            })

    if not dry_run and templates:
        print(f"\nSuggested {len(templates)} templates:")
        for t in templates:
            print(f"  [{t['confidence']:.0%}] {t['domain']}: {t['suggestion']}")

    return templates


def main():
    parser = argparse.ArgumentParser(
        description="Post-ingest reflection and learning extraction"
    )
    parser.add_argument(
        "--last", type=int, default=1,
        help="Number of recent log entries to reflect on (default: 1)"
    )
    parser.add_argument(
        "--suggest-skills", action="store_true",
        help="Analyze patterns and suggest reusable skills"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview reflection results without writing files"
    )
    args = parser.parse_args()

    result = run_reflection(
        last_n=args.last,
        suggest_skills=args.suggest_skills,
        dry_run=args.dry_run,
    )
    if not result:
        sys.exit(1)


if __name__ == "__main__":
    main()
