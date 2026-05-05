#!/usr/bin/env python3
"""
Ingest a source document into the LLM Wiki.

Usage:
    python tools/ingest.py <path-to-source>
    python tools/ingest.py raw/articles/my-article.md
    python tools/ingest.py report.pdf                  # auto-converts to .md
    python tools/ingest.py slides.pptx notes.docx       # batch, mixed formats
    python tools/ingest.py raw/mixed/ --no-convert      # skip auto-conversion
    python tools/ingest.py --validate-only              # run validation only

Supported formats (auto-converted via markitdown):
    .pdf .docx .pptx .xlsx .html .htm .txt .csv .json .xml
    .rst .rtf .epub .ipynb .yaml .yml .tsv .wav .mp3

The LLM reads the source, extracts knowledge, and updates the wiki:
  - Creates wiki/sources/<slug>.md
  - Updates wiki/index.md
  - Updates wiki/overview.md (if warranted)
  - Creates/updates entity and concept pages
  - Appends to wiki/log.md
  - Flags contradictions
  - Runs post-ingest validation (broken links, index coverage)
"""

import os
import sys
import json
import hashlib
import re
import shutil
import tempfile
from pathlib import Path
from collections import defaultdict
from datetime import date

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
AGENT_DIR = WIKI_DIR / ".agent"


class IngestError(Exception):
    """Raised when ingest encounters an unrecoverable error."""
LOG_FILE = WIKI_DIR / "log.md"
INDEX_FILE = WIKI_DIR / "index.md"
OVERVIEW_FILE = WIKI_DIR / "overview.md"
CHECKPOINT_FILE = REPO_ROOT / ".cache" / "ingest-checkpoint.json"


# ── Shared utilities (with inline fallback) ─────────────────────────
try:
    from tools.shared.wiki import read_file, write_file
except ImportError:
    def read_file(path: Path) -> str:
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def write_file(path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"  wrote: {path.relative_to(REPO_ROOT)}")


def _load_checkpoint() -> dict:
    """Load ingest checkpoint mapping file paths to their last-known hash and status."""
    if CHECKPOINT_FILE.exists():
        try:
            return json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_checkpoint(checkpoint: dict) -> None:
    """Persist the ingest checkpoint to disk."""
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_FILE.write_text(json.dumps(checkpoint, indent=2, ensure_ascii=False), encoding="utf-8")


def _file_hash(path: Path) -> str:
    """Return SHA256 hex digest of a file's bytes."""
    h = hashlib.sha256()
    try:
        h.update(path.read_bytes())
    except OSError:
        return ""
    return h.hexdigest()


def _load_agent_context() -> str:
    """Load agent memory (MEMORY.md + USER.md) as system context string."""
    parts = []
    for name in ("MEMORY.md", "USER.md"):
        path = AGENT_DIR / name
        if path.exists():
            content = path.read_text(encoding="utf-8").strip()
            if content:
                parts.append(content)
    return "\n\n---\n\n".join(parts) if parts else ""


# File extensions that can be auto-converted to markdown via markitdown.
# .md files are ingested directly without conversion.
CONVERTIBLE_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".xls",
    ".html", ".htm", ".txt", ".csv", ".json", ".xml",
    ".rst", ".rtf", ".epub", ".ipynb",
    ".yaml", ".yml", ".tsv",
    ".wav", ".mp3",  # audio transcription via markitdown
}
ALL_SUPPORTED_EXTENSIONS = {".md"} | CONVERTIBLE_EXTENSIONS
SCHEMA_FILE = REPO_ROOT / "CLAUDE.md"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:32]


# ── Shared path safety (with inline fallback) ──
try:
    from tools.shared.paths import sanitize_wiki_path
except ImportError:
    def sanitize_wiki_path(path_str: str, base_dir: Path) -> Path:
        if not path_str or path_str in (".", ".."):
            raise ValueError("Invalid path")
        path_str = path_str.lstrip("/\\")
        target = (base_dir / path_str).resolve()
        base = base_dir.resolve()
        try:
            target.relative_to(base)
        except ValueError:
            raise ValueError("Path traversal blocked")
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

    def call_llm(prompt: str, model_env: str = "LLM_MODEL", default_model: str = "anthropic/claude-3-5-sonnet-latest", max_tokens: int = 4096) -> str:
        try:
            from litellm import completion
        except ImportError:
            print("Error: litellm not installed. Run: pip install litellm")
            raise IngestError("litellm not installed")

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


def build_wiki_context(max_page_chars: int = 2000) -> str:
    parts = []
    if INDEX_FILE.exists():
        parts.append(f"## wiki/index.md\n{read_file(INDEX_FILE)}")
    if OVERVIEW_FILE.exists():
        overview = read_file(OVERVIEW_FILE)
        parts.append(f"## wiki/overview.md\n{overview[:max_page_chars]}")
    sources_dir = WIKI_DIR / "sources"
    if sources_dir.exists():
        recent = sorted(sources_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)[:5]
        for p in recent:
            content = read_file(p)
            if len(content) > max_page_chars:
                content = content[:max_page_chars] + "\n... (truncated)"
            parts.append(f"## {p.relative_to(REPO_ROOT)}\n{content}")
    return "\n\n---\n\n".join(parts)


def parse_json_from_response(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in response")
    depth = 0
    end = start
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if depth != 0:
        raise ValueError("Unbalanced JSON braces in response")
    return json.loads(text[start:end])


def update_index(new_entry: str, section: str = "Sources"):
    content = read_file(INDEX_FILE)
    if not content:
        content = "# Wiki Index\n\n## Overview\n- [Overview](overview.md) — living synthesis\n\n## Sources\n\n## Entities\n\n## Concepts\n\n## Syntheses\n"
    # Deduplication: skip if exact line already present
    if new_entry.strip() in content:
        return
    section_header = f"## {section}"
    if section_header in content:
        idx = content.index(section_header)
        insert_pos = idx + len(section_header)
        # Find the end of the header line
        newline_pos = content.find("\n", insert_pos)
        if newline_pos == -1:
            content = content.rstrip() + "\n" + new_entry + "\n"
        else:
            content = content[:newline_pos + 1] + new_entry + "\n" + content[newline_pos + 1:]
    else:
        content += f"\n{section_header}\n{new_entry}\n"
    write_file(INDEX_FILE, content)


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
            write_file(LOG_FILE, LOG_HEADER + "\n" + entry_text + "\n")
            return
        existing = read_file(LOG_FILE).strip()
        if entry_text in existing:
            return
        if existing.startswith("# Wiki Log"):
            parts = existing.split("\n---\n", 1)
            if len(parts) == 2:
                new_content = parts[0] + "\n---\n\n" + entry_text + "\n\n" + parts[1].strip()
            else:
                new_content = entry_text + "\n\n" + existing
        else:
            new_content = entry_text + "\n\n" + existing
        write_file(LOG_FILE, new_content)


# ── Shared wiki helpers (with inline fallback) ──────────────────────
try:
    from tools.shared.wiki import all_wiki_page_stems
except ImportError:
    def all_wiki_page_stems() -> set[str]:
        exclude = {"index.md", "log.md", "lint-report.md", "health-report.md"}
        pages = set()
        for p in WIKI_DIR.rglob("*.md"):
            if p.name not in exclude:
                pages.add(p.stem.lower())
        return pages


def extract_wikilinks(content: str) -> list[str]:
    """Extract all [[WikiLink]] targets from page content.

    Handles both [[PageName]] and [[PageName|display alias]] formats.
    Returns the raw link text (including alias if present) for validation.
    """
    return re.findall(r'\[\[([^\]]+)\]\]', content)


def validate_ingest(changed_pages: list[str] | None = None) -> dict:
    """Validate wiki integrity after an ingest.

    Checks:
      1. Broken wikilinks in changed pages (or all pages if none specified)
      2. Pages not registered in index.md

    Returns dict with 'broken_links' and 'unindexed' lists.
    """
    existing_pages = all_wiki_page_stems()
    index_content = read_file(INDEX_FILE).lower()

    # Determine which pages to scan for broken links
    if changed_pages:
        scan_paths = [(WIKI_DIR / p).resolve() for p in changed_pages if (WIKI_DIR / p).exists()]
        scan_paths = [p for p in scan_paths if str(p).startswith(str(WIKI_DIR.resolve()))]
    else:
        scan_paths = [p for p in WIKI_DIR.rglob("*.md")
                      if p.name not in ("index.md", "log.md", "lint-report.md", "health-report.md")]

    # Check 1: Broken wikilinks
    broken_links = []
    for page_path in scan_paths:
        content = read_file(page_path)
        rel = str(page_path.relative_to(WIKI_DIR))
        for link in extract_wikilinks(content):
            # Handle [[PageName|display alias]] format — extract page name before |
            link_target = link.split("|")[0].strip()
            # Normalize: strip paths (both / and \), check stem only
            link_stem = Path(link_target.replace("\\", "/")).stem.lower()
            if link_stem not in existing_pages:
                broken_links.append((rel, link))

    # Check 2: Unindexed pages (only check changed pages)
    unindexed = []
    for p in (changed_pages or []):
        page_path = WIKI_DIR / p
        if page_path.exists():
            # Check if the page filename appears in index.md
            stem = page_path.stem.lower()
            if stem not in index_content and p not in ("log.md", "overview.md"):
                unindexed.append(p)

    return {"broken_links": broken_links, "unindexed": unindexed}


def convert_to_md(source: Path) -> Path:
    """Convert a non-markdown file to .md using markitdown.

    Returns the path to the converted .md file (placed next to the original
    with a .md extension, or in a temp location if the source dir is read-only).
    """
    try:
        from markitdown import MarkItDown
    except ImportError:
        print("Error: markitdown not installed (needed to convert non-.md files).")
        print("  Install with: pip install markitdown")
        raise IngestError("markitdown not installed")

    md = MarkItDown(enable_plugins=False)
    try:
        result = md.convert(str(source))
    except Exception as e:
        print(f"Error: failed to convert '{source.name}': {e}")
        raise IngestError(f"Conversion failed: {e}")

    # Write converted output next to source as <name>.md
    output = source.with_suffix(".md")
    try:
        output.write_text(result.text_content, encoding="utf-8")
    except OSError:
        # Fallback: source directory may be read-only
        tmpdir = Path(tempfile.mkdtemp())
        tmp = tmpdir / f"{source.stem}.md"
        tmp.write_text(result.text_content, encoding="utf-8")
        import atexit, shutil
        atexit.register(shutil.rmtree, str(tmpdir), ignore_errors=True)
        output = tmp

    print(f"  ✓ Converted {source.name} → {output.name}")
    return output


def ingest(source_path: str, auto_convert: bool = True, checkpoint: dict | None = None) -> dict:
    """Ingest a single source document into the wiki.

    Returns a result dict:
        {
            "success": bool,
            "title": str | None,
            "slug": str | None,
            "created_pages": list[str],
            "error": str | None,
        }
    """
    result = {
        "success": False,
        "title": None,
        "slug": None,
        "created_pages": [],
        "error": None,
    }
    cp = checkpoint if checkpoint is not None else {}

    source = Path(source_path)
    if not source.exists():
        print(f"Error: file not found: {source_path}")
        raise IngestError(f"File not found: {source_path}")

    # Auto-convert non-markdown files
    converted_path = None
    if source.suffix.lower() != ".md":
        if not auto_convert:
            print(f"  Skipping non-.md file (--no-convert): {source.name}")
            return {"success": False, "error": f"Skipped non-.md file: {source.name}"}
        if source.suffix.lower() not in CONVERTIBLE_EXTENSIONS:
            print(f"  ⚠️  Unsupported format: {source.suffix} — skipping {source.name}")
            print(f"       Supported: {', '.join(sorted(ALL_SUPPORTED_EXTENSIONS))}")
            return {"success": False, "error": f"Unsupported format: {source.suffix}"}
        print(f"  Converting {source.name} to markdown...")
        converted_path = convert_to_md(source)
        source = converted_path

    source_bytes = source.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    today = date.today().isoformat()

    # Incremental check: skip if hash unchanged and previously succeeded
    cp_key = str(source.resolve())
    prev = cp.get(cp_key)
    if prev and prev.get("hash") == source_hash and prev.get("status") == "success":
        print(f"  ⏭  Skipping (unchanged): {source.name}")
        result["success"] = True
        result["title"] = prev.get("title")
        result["slug"] = prev.get("slug")
        return result

    source_content = source.read_text(encoding="utf-8")

    print(f"\nIngesting: {source.name}  (hash: {source_hash})")

    wiki_context = build_wiki_context()
    schema = read_file(SCHEMA_FILE)
    agent_context = _load_agent_context()

    prompt = f"""You are maintaining an LLM Wiki. Process this source document and integrate its knowledge into the wiki.

Schema and conventions:
{schema}

{f"Agent memory and user preferences:\n{agent_context}" if agent_context else ""}

Current wiki state (index + recent pages):
{wiki_context if wiki_context else "(wiki is empty — this is the first source)"}

New source to ingest (file: {source.relative_to(REPO_ROOT) if source.is_relative_to(REPO_ROOT) else source.name}):
=== SOURCE START ===
{source_content}
=== SOURCE END ===

Today's date: {today}

Return ONLY a valid JSON object with these fields (no markdown fences, no prose outside the JSON):
{{
  "title": "Human-readable title for this source",
  "slug": "kebab-case-slug-for-filename",
  "source_page": "full markdown content for wiki/sources/<slug>.md — use the source page format from the schema. CRITICAL: Aggressively convert key people, products, concepts and projects into [[Wikilinks]] inline in the text. Omitting [[ ]] for known terms is a failure.",
  "index_entry": "- [Title](sources/slug.md) — one-line summary",
  "overview_update": "full updated content for wiki/overview.md, or null if no update needed",
  "entity_pages": [
    {{"path": "entities/EntityName.md", "content": "full markdown content"}}
  ],
  "concept_pages": [
    {{"path": "concepts/ConceptName.md", "content": "full markdown content"}}
  ],
  "contradictions": ["describe any contradiction with existing wiki content, or empty list"],
  "log_entry": "## [{today}] ingest | <title>\\n\\nAdded source. Key claims: ..."
}}
"""

    print(f"  calling API (model: {os.getenv('LLM_MODEL', 'anthropic/claude-3-5-sonnet-latest')})")
    raw = call_llm(prompt, max_tokens=8192)
    if not raw:
        raise IngestError("LLM returned empty response")
    try:
        data = parse_json_from_response(raw)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Error parsing API response: {e}")
        debug_path = Path(tempfile.gettempdir()) / "ingest_debug.txt"
        debug_path.write_text(raw, encoding="utf-8")
        print(f"Raw response saved to {debug_path}")
        raise IngestError(f"JSON parse error: {e}")

    # Validate required keys
    required_keys = ["slug", "source_page", "index_entry", "log_entry"]
    missing_keys = [k for k in required_keys if k not in data]
    if missing_keys:
        print(f"Error: LLM response missing required keys: {missing_keys}")
        raise IngestError(f"Missing required keys: {missing_keys}")

    # Write source page
    slug = data["slug"]
    # Sanitize slug to prevent path traversal
    safe_slug = Path(slug).name
    if not safe_slug or safe_slug == "." or safe_slug == "..":
        print(f"Error: invalid slug from LLM: {slug!r}")
        raise IngestError(f"Invalid slug: {slug!r}")
    write_file(WIKI_DIR / "sources" / f"{safe_slug}.md", data["source_page"])

    # Write entity pages
    for page in data.get("entity_pages", []):
        page_path = sanitize_wiki_path(page["path"], WIKI_DIR)
        write_file(page_path, page["content"])

    # Write concept pages
    for page in data.get("concept_pages", []):
        page_path = sanitize_wiki_path(page["path"], WIKI_DIR)
        write_file(page_path, page["content"])

    # Update overview
    if data.get("overview_update"):
        write_file(OVERVIEW_FILE, data["overview_update"])

    # Update index
    update_index(data["index_entry"], section="Sources")

    # Append log
    append_log(data["log_entry"])

    # Report contradictions
    contradictions = data.get("contradictions", [])
    if contradictions:
        print("\n  ⚠️  Contradictions detected:")
        for c in contradictions:
            print(f"     - {c}")

    # --- Post-ingest validation ---
    created_pages = [f"sources/{slug}.md"]
    for page in data.get("entity_pages", []):
        created_pages.append(page["path"])
    for page in data.get("concept_pages", []):
        created_pages.append(page["path"])
    updated_pages = ["index.md", "log.md"]
    if data.get("overview_update"):
        updated_pages.append("overview.md")

    validation = validate_ingest(created_pages)
    if validation.get("broken_links"):
        print(f"  ⚠  Found {len(validation['broken_links'])} broken wikilinks:")
        for page, link in validation["broken_links"][:10]:
            print(f"      wiki/{page} → [[{link}]]")
        if len(validation["broken_links"]) > 10:
            print(f"      ... and {len(validation['broken_links']) - 10} more")
    if validation.get("unindexed"):
        print(f"  ⚠  Found {len(validation['unindexed'])} unindexed pages: {validation['unindexed']}")

    # --- Post-ingest reflection ---
    try:
        from tools.reflect import run_reflection
        print("\n  🔄 Running post-ingest reflection...")
        run_reflection(last_n=1, suggest_skills=False, dry_run=False)
    except Exception as exc:
        print(f"  ⚠  Reflection skipped: {exc}")

    # Update checkpoint on success
    result["success"] = True
    result["title"] = data.get("title")
    result["slug"] = slug
    result["created_pages"] = created_pages
    cp[cp_key] = {
        "hash": source_hash,
        "status": "success",
        "title": data.get("title"),
        "slug": slug,
        "timestamp": today,
    }
    return result


if __name__ == "__main__":
    # Handle --validate-only flag
    if len(sys.argv) == 2 and sys.argv[1] == "--validate-only":
        print("Running wiki validation (no ingest)...\n")
        result = validate_ingest()
        if result["broken_links"]:
            print(f"Broken wikilinks: {len(result['broken_links'])}")
            for page, link in result["broken_links"][:20]:
                print(f"  wiki/{page} → [[{link}]]")
            if len(result["broken_links"]) > 20:
                print(f"  ... and {len(result['broken_links']) - 20} more")
        else:
            print("No broken wikilinks found.")
        print()
        pages = all_wiki_page_stems()
        index_content = read_file(INDEX_FILE).lower()
        unindexed_all = []
        for p in WIKI_DIR.rglob("*.md"):
            if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md", "overview.md"):
                continue
            if p.stem.lower() not in index_content:
                unindexed_all.append(str(p.relative_to(WIKI_DIR)))
        if unindexed_all:
            print(f"Pages not in index.md: {len(unindexed_all)}")
            for up in unindexed_all[:20]:
                print(f"  wiki/{up}")
            if len(unindexed_all) > 20:
                print(f"  ... and {len(unindexed_all) - 20} more")
        else:
            print("All pages are indexed.")
        sys.exit(0)

    # Parse flags
    no_convert = "--no-convert" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if not args:
        print("Usage: python tools/ingest.py <path-to-source> [path2 ...] [dir1 ...]")
        print("       python tools/ingest.py --validate-only")
        print("       python tools/ingest.py --no-convert   # skip auto-conversion of non-.md files")
        print("       python tools/ingest.py --resume       # skip previously successful files")
        print("       python tools/ingest.py --incremental  # skip unchanged files (hash-based)")
        print(f"\nSupported formats: {', '.join(sorted(ALL_SUPPORTED_EXTENSIONS))}")
        sys.exit(1)

    resume = "--resume" in sys.argv
    incremental = "--incremental" in sys.argv
    checkpoint = _load_checkpoint()

    paths_to_process = []
    for arg in args:
        p = Path(arg)
        if p.is_file():
            ext = p.suffix.lower()
            if ext in ALL_SUPPORTED_EXTENSIONS:
                paths_to_process.append(p)
            else:
                print(f"  ⚠️  Skipping unsupported format: {p.name} ({ext})")
        elif p.is_dir():
            for f in p.rglob("*"):
                # Skip hidden files, .git, and temp files
                if any(part.startswith(".") for part in f.relative_to(p).parts):
                    continue
                if f.is_file() and f.suffix.lower() in ALL_SUPPORTED_EXTENSIONS:
                    paths_to_process.append(f)
        else:
            import glob
            for f in glob.glob(arg, recursive=True):
                g_p = Path(f)
                if g_p.is_file() and g_p.suffix.lower() in ALL_SUPPORTED_EXTENSIONS:
                    paths_to_process.append(g_p)

    # Deduplicate while preserving order
    unique_paths = []
    seen = set()
    for p in paths_to_process:
        abs_p = p.resolve()
        if abs_p not in seen:
            seen.add(abs_p)
            unique_paths.append(p)

    if not unique_paths:
        print("Error: no supported files found to ingest.")
        print(f"Supported formats: {', '.join(sorted(ALL_SUPPORTED_EXTENSIONS))}")
        sys.exit(1)

    # Resume: filter out files that previously succeeded
    if resume:
        filtered = []
        for p in unique_paths:
            cp_key = str(p.resolve())
            prev = checkpoint.get(cp_key)
            if prev and prev.get("status") == "success":
                print(f"  ⏭  Resume skip (previous success): {p.name}")
                continue
            filtered.append(p)
        unique_paths = filtered
        if not unique_paths:
            print("All files were previously ingested successfully. Nothing to do.")
            sys.exit(0)

    if len(unique_paths) > 1:
        print(f"Batch mode: found {len(unique_paths)} files to ingest.")
        if resume or incremental:
            print(f"  (resume={resume}, incremental={incremental})")

    success_count = 0
    fail_count = 0
    for p in unique_paths:
        try:
            result = ingest(str(p), auto_convert=not no_convert, checkpoint=checkpoint)
            if result["success"]:
                success_count += 1
            else:
                fail_count += 1
        except IngestError as e:
            fail_count += 1
            print(f"  ❌ Failed: {p.name} ({e})")
            checkpoint[str(p.resolve())] = {
                "hash": _file_hash(p),
                "status": "failed",
                "timestamp": date.today().isoformat(),
            }
            _save_checkpoint(checkpoint)
        except Exception as e:
            fail_count += 1
            print(f"  ❌ Unexpected error on {p.name}: {e}")
            checkpoint[str(p.resolve())] = {
                "hash": _file_hash(p),
                "status": "failed",
                "timestamp": date.today().isoformat(),
            }
            _save_checkpoint(checkpoint)

    _save_checkpoint(checkpoint)

    print(f"\n{'='*50}")
    print(f"Batch complete: {success_count} succeeded, {fail_count} failed")
    print(f"{'='*50}")
    if fail_count > 0:
        print(f"Run with --resume to retry failed files only.")
    sys.exit(0 if fail_count == 0 else 1)
