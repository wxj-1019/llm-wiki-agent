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
import io
import json
import hashlib
import time

# Fix Windows GBK console encoding for emoji output
if sys.platform == "win32" and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)
import re
import shutil
import tempfile
from pathlib import Path
from collections import defaultdict
from datetime import date

REPO_ROOT = Path(__file__).parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
AGENT_DIR = WIKI_DIR / ".agent"

try:
    from tools.shared.logging_config import get_logger
    logger = get_logger("ingest")
except ImportError:
    import logging
    logger = logging.getLogger("wiki.ingest")


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
        print(f"  wrote: {path.relative_to(REPO_ROOT)}")


def _load_checkpoint() -> dict:
    """Load ingest checkpoint mapping file paths to their last-known hash and status."""
    if CHECKPOINT_FILE.exists():
        try:
            data = json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
            logger.info("Checkpoint loaded | path=%s entries=%d", CHECKPOINT_FILE, len(data))
            return data
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Checkpoint load failed (discarding) | path=%s error_type=%s error=%s",
                           CHECKPOINT_FILE, type(e).__name__, e)
    return {}


def _save_checkpoint(checkpoint: dict) -> None:
    """Persist the ingest checkpoint to disk atomically."""
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(checkpoint, indent=2, ensure_ascii=False)
    fd, tmp_path = tempfile.mkstemp(dir=str(CHECKPOINT_FILE.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, str(CHECKPOINT_FILE))
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
    logger.debug("Checkpoint saved | path=%s entries=%d", CHECKPOINT_FILE, len(checkpoint))


def _file_hash(path: Path) -> str:
    """Return SHA256 hex digest of a file's bytes.

    Returns a unique error marker (not empty string) on failure so two
    different unreadable files don't hash-collide.
    """
    h = hashlib.sha256()
    try:
        h.update(path.read_bytes())
    except OSError:
        return f"error:{path.resolve().as_posix()}"
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
# Code files are ingested as plain text (no conversion) with optional AST analysis.
CODE_EXTENSIONS = {".py", ".js", ".ts", ".tsx", ".jsx"}
ALL_SUPPORTED_EXTENSIONS = {".md"} | CONVERTIBLE_EXTENSIONS | CODE_EXTENSIONS
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

    def call_llm(prompt: str, model_env: str = "LLM_MODEL", default_model: str = "anthropic/claude-3-5-sonnet-latest", max_tokens: int = 4096, system: str = "", temperature: float | None = None) -> str:
        try:
            from litellm import completion
        except ImportError:
            logger.error("litellm not installed")
            print("Error: litellm not installed. Run: pip install litellm")
            raise IngestError("litellm not installed")

        cfg = _load_llm_config()
        model = cfg.get("model") or os.getenv(model_env) or default_model
        provider = cfg.get("provider", "anthropic")
        if model and "/" not in model:
            model = f"{provider}/{model}"
        elif not model:
            model = default_model
        api_key = cfg.get("api_key", "")

        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs: dict = {
            "model": model,
            "messages": messages,
        }

        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        if api_key:
            kwargs["api_key"] = api_key
        if temperature is not None:
            kwargs["temperature"] = temperature

        logger.info("LLM request (fallback) | model=%s prompt_chars=%d max_tokens=%d", model, len(prompt), max_tokens)
        t0 = time.monotonic()
        try:
            response = completion(**kwargs)
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            raise
        elapsed = time.monotonic() - t0
        if not response.choices:
            raise RuntimeError("LLM returned empty choices (possible content filter)")
        content = response.choices[0].message.content or ""
        logger.info("LLM response (fallback) | model=%s elapsed=%.2fs response_chars=%d", model, elapsed, len(content))
        return content


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


def _extract_code_ast_summary(file_path: Path, repo_root: Path) -> str:
    """Extract a human-readable AST summary from a code file for LLM context.

    Returns empty string if tree-sitter is unavailable or parsing fails.
    """
    try:
        from tools.shared.code_graph.registry import get_parser
    except ImportError:
        return ""

    # Ensure absolute path so relative_to works in parsers
    file_path = file_path.resolve()
    repo_root = repo_root.resolve()

    parser = get_parser(str(file_path))
    if not parser:
        return ""

    try:
        nodes, edges = parser.parse(file_path, repo_root)
    except Exception as exc:
        logger.warning("Code AST parse failed | file=%s error=%s", file_path.name, exc)
        return ""

    module = None
    classes: list[dict] = []
    functions: list[dict] = []
    imports: list[str] = []
    inherits: dict[str, list[str]] = {}
    contains: dict[str, list[str]] = {}

    for n in nodes:
        t = n.type if hasattr(n, "type") else n.get("type")
        if t == "code_module":
            module = n.to_dict() if hasattr(n, "to_dict") else n
        elif t == "code_class":
            classes.append(n.to_dict() if hasattr(n, "to_dict") else n)
        elif t == "code_func":
            functions.append(n.to_dict() if hasattr(n, "to_dict") else n)

    seen_imports: set[str] = set()
    for e in edges:
        et = e.edge_type if hasattr(e, "edge_type") else e.get("type")
        target = e.target if hasattr(e, "target") else e.get("to")
        source_id = e.source if hasattr(e, "source") else e.get("from")
        if et == "IMPORTS":
            if target and target not in seen_imports:
                seen_imports.add(target)
                imports.append(target)
        elif et == "INHERITS":
            inherits.setdefault(source_id, []).append(target)
        elif et == "CONTAINS":
            contains.setdefault(source_id, []).append(target)

    lines: list[str] = []
    if module:
        label = module.get("label", "?")
        lang = module.get("language", "?")
        lines.append(f"- Module: `{label}` ({lang})")

    if classes:
        lines.append("- Classes:")
        for c in classes:
            label = c.get("label", "?")
            line_start = c.get("line_start", "?")
            cls_id = c.get("id", "")
            extra = ""
            if cls_id in inherits:
                bases = [b.split("#")[-1] for b in inherits[cls_id]]
                extra = f" inherits {', '.join(f'`{b}`' for b in bases)}"
            lines.append(f"  - `{label}` (line {line_start}){extra}")

    if functions:
        lines.append("- Functions:")
        for f in functions:
            label = f.get("label", "?")
            line_start = f.get("line_start", "?")
            lines.append(f"  - `{label}` (line {line_start})")

    if imports:
        lines.append("- Imports:")
        for i in imports:
            lines.append(f"  - `{i}`")

    return "\n".join(lines) if lines else ""


def parse_json_from_response(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in response")
    depth = 0
    end = start
    in_string = False       # double-quoted string
    escape_next = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape_next:
                escape_next = False
            elif ch == "\\":
                escape_next = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
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
        content = "# Wiki Index\n\n## Overview\n- [Overview](overview.md) — living synthesis\n\n## Sources\n\n## Entities\n\n## Concepts\n\n## Code\n\n## Syntheses\n"
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
    return re.findall(r'\[\[([^\[\]]+(?:\|[^\[\]]+)?)\]\]', content)


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
            link_stem = link_target.replace("\\", "/").split("/")[-1].strip().lower()
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

    # Auto-convert non-markdown files (skip conversion for code files)
    converted_path = None
    is_code = source.suffix.lower() in CODE_EXTENSIONS
    if source.suffix.lower() != ".md" and not is_code:
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
    if len(source_bytes) > 50 * 1024 * 1024:
        raise IngestError(f"File too large ({len(source_bytes) / 1024 / 1024:.1f}MB > 50MB): {source}")
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

    # Extract AST summary for code files (best-effort, graceful fallback)
    code_context = ""
    if is_code:
        code_context = _extract_code_ast_summary(source, REPO_ROOT)
        if code_context:
            print(f"  🔍 AST summary extracted ({len(code_context)} chars)")
        # Smart truncation for large code files to keep prompt size reasonable
        n_lines = source_content.count("\n")
        if n_lines > 300:
            lines = source_content.splitlines()
            head = "\n".join(lines[:200])
            tail = "\n".join(lines[-50:])
            source_content = (
                f"{head}\n\n"
                f"[... {n_lines - 250} lines truncated; full AST structure summary provided above ...]\n\n"
                f"{tail}"
            )
            print(f"  ✂️  Code truncated ({n_lines} → ~250 lines) to fit prompt budget")

    print(f"\nIngesting: {source.name}  (hash: {source_hash})")
    logger.info("Ingest start | file=%s hash=%s source_chars=%d code_ast=%s",
                source.name, source_hash, len(source_content), bool(code_context))

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

{f"Code structure analysis (AST):\n{code_context}\n" if code_context else ""}
Today's date: {today}

Return ONLY a valid JSON object with these fields (no markdown fences, no prose outside the JSON):

CRITICAL NAMING RULES — violations cause broken links and unindexed pages:
- `slug` must be kebab-case (e.g., "my-source-name"), NO spaces.
- `entity_pages[].path` must be `entities/TitleCaseNoSpaces.md` (e.g., `entities/HyperledgerFabric.md`). NEVER use spaces or hyphens inside the name.
- `concept_pages[].path` must be `concepts/TitleCaseNoSpaces.md`, same rules.
- Every `[[WikiLink]]` inside ALL markdown content must EXACTLY match the target file's stem.
  - Example: if entity file is `entities/HyperledgerFabric.md`, the link must be `[[HyperledgerFabric]]`, NEVER `[[Hyperledger Fabric]]`.
  - For Chinese names, use Chinese links exactly matching the Chinese filename: `[[能源大数据平台]]`. Do NOT use English aliases like `[[EnergyBigDataPlatform|能源大数据平台]]`.

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
  "code_pages": [
    {{"path": "code/ModuleOrClassName.md", "content": "full markdown content with YAML frontmatter (type: code_module|code_class|code_func). Use this ONLY for source code files to document notable modules, classes, or public functions. Include signature, purpose, parameters/returns, and wikilinks to related code/entity/concept pages."}}
  ],
  "contradictions": ["describe any contradiction with existing wiki content, or empty list"],
  "log_entry": "## [{today}] ingest | <title>\\n\\nAdded source. Key claims: ..."
}}
"""

    print(f"  calling API (model: {os.getenv('LLM_MODEL', 'anthropic/claude-3-5-sonnet-latest')})")
    t0 = time.monotonic()
    raw = call_llm(prompt, max_tokens=8192)
    elapsed = time.monotonic() - t0
    if not raw:
        logger.error("LLM returned empty response | elapsed=%.2fs", elapsed)
        raise IngestError("LLM returned empty response")
    logger.info("LLM call complete | elapsed=%.2fs response_chars=%d", elapsed, len(raw))
    try:
        data = parse_json_from_response(raw)
        logger.info("JSON parsed | keys=%s", list(data.keys()))
    except (ValueError, json.JSONDecodeError) as e:
        logger.error("JSON parse failed | error_type=%s error=%s response_first_200=%s",
                     type(e).__name__, e, raw[:200].replace("\n", "\\n"))
        print(f"Error parsing API response: {e}")
        debug_path = Path(tempfile.gettempdir()) / "ingest_debug.txt"
        debug_path.write_text(raw, encoding="utf-8")
        print(f"Raw response saved to {debug_path}")
        raise IngestError(f"JSON parse error: {e}")

    # Validate required keys
    required_keys = ["slug", "source_page", "index_entry", "log_entry"]
    missing_keys = [k for k in required_keys if k not in data]
    if missing_keys:
        logger.error("Missing required keys | missing=%s present=%s", missing_keys, list(data.keys()))
        print(f"Error: LLM response missing required keys: {missing_keys}")
        raise IngestError(f"Missing required keys: {missing_keys}")

    # Write source page
    slug = data["slug"]
    safe_slug = Path(slug).name
    if not safe_slug or safe_slug == "." or safe_slug == "..":
        logger.error("Invalid slug from LLM | slug=%r", slug)
        print(f"Error: invalid slug from LLM: {slug!r}")
        raise IngestError(f"Invalid slug: {slug!r}")
    wiki_source_path = WIKI_DIR / "sources" / f"{safe_slug}.md"
    write_file(wiki_source_path, data["source_page"])
    logger.info("Source page written | path=%s slug=%s", wiki_source_path.relative_to(REPO_ROOT), safe_slug)

    def _extract_title_from_content(content: str, fallback: str) -> str:
        if content.startswith("---"):
            fm_end = content.find("---", 3)
            if fm_end != -1:
                fm = content[3:fm_end]
                m = re.search(r'^title:\s*"?([^"\n]+)"?', fm, re.MULTILINE)
                if m:
                    return m.group(1).strip()
        return fallback

    entity_pages = data.get("entity_pages", [])
    concept_pages = data.get("concept_pages", [])
    logger.info("LLM returned | entity_pages=%d concept_pages=%d contradictions=%d",
                len(entity_pages), len(concept_pages), len(data.get("contradictions", [])))

    for page in entity_pages:
        page_path = sanitize_wiki_path(page["path"], WIKI_DIR)
        write_file(page_path, page["content"])
        title = _extract_title_from_content(page["content"], page_path.stem)
        entry = f"- [{title}]({page_path.relative_to(WIKI_DIR).as_posix()}) — auto-created entity"
        update_index(entry, section="Entities")
        logger.debug("Entity page written | path=%s title=%s", page_path.relative_to(WIKI_DIR), title)

    for page in concept_pages:
        page_path = sanitize_wiki_path(page["path"], WIKI_DIR)
        write_file(page_path, page["content"])
        title = _extract_title_from_content(page["content"], page_path.stem)
        entry = f"- [{title}]({page_path.relative_to(WIKI_DIR).as_posix()}) — auto-created concept"
        update_index(entry, section="Concepts")
        logger.debug("Concept page written | path=%s title=%s", page_path.relative_to(WIKI_DIR), title)

    code_pages = data.get("code_pages", [])
    if code_pages:
        logger.info("Code pages returned | count=%d", len(code_pages))
    for page in code_pages:
        page_path = sanitize_wiki_path(page["path"], WIKI_DIR)
        write_file(page_path, page["content"])
        title = _extract_title_from_content(page["content"], page_path.stem)
        entry = f"- [{title}]({page_path.relative_to(WIKI_DIR).as_posix()}) — auto-created code page"
        update_index(entry, section="Code")
        logger.debug("Code page written | path=%s title=%s", page_path.relative_to(WIKI_DIR), title)

    if data.get("overview_update"):
        write_file(OVERVIEW_FILE, data["overview_update"])
        logger.info("Overview updated")

    update_index(data["index_entry"], section="Sources")
    append_log(data["log_entry"])

    contradictions = data.get("contradictions", [])
    if contradictions:
        logger.warning("Contradictions detected | count=%d", len(contradictions))
        print("\n  ⚠️  Contradictions detected:")
        for c in contradictions:
            print(f"     - {c}")

    # --- Post-ingest validation ---
    created_pages = [f"sources/{slug}.md"]
    for page in data.get("entity_pages", []):
        created_pages.append(page["path"])
    for page in data.get("concept_pages", []):
        created_pages.append(page["path"])
    for page in data.get("code_pages", []):
        created_pages.append(page["path"])
    updated_pages = ["index.md", "log.md"]
    if data.get("overview_update"):
        updated_pages.append("overview.md")

    # Normalize wikilinks to match actual filenames
    try:
        from tools.shared.wiki import normalize_wikilinks
    except ImportError:
        normalize_wikilinks = None

    if normalize_wikilinks:
        canonical_map = {}
        for p in WIKI_DIR.rglob("*.md"):
            if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
                continue
            stem = p.stem
            canonical_map[stem.lower()] = stem
            canonical_map[stem.lower().replace(" ", "").replace("-", "")] = stem

        for page_path in created_pages + updated_pages:
            full_path = WIKI_DIR / page_path
            if full_path.exists():
                c = read_file(full_path)
                nc = normalize_wikilinks(c, canonical_map)
                if nc != c:
                    write_file(full_path, nc)

    validation = validate_ingest(created_pages)
    if validation.get("broken_links"):
        logger.warning("Broken wikilinks found | count=%d", len(validation['broken_links']))
        print(f"  ⚠  Found {len(validation['broken_links'])} broken wikilinks:")
        for page, link in validation["broken_links"][:10]:
            print(f"      wiki/{page} → [[{link}]]")
        if len(validation["broken_links"]) > 10:
            print(f"      ... and {len(validation['broken_links']) - 10} more")
    if validation.get("unindexed"):
        logger.warning("Unindexed pages found | count=%d pages=%s", len(validation['unindexed']), validation['unindexed'])
        print(f"  ⚠  Found {len(validation['unindexed'])} unindexed pages: {validation['unindexed']}")

    try:
        from tools.reflect import run_reflection
        logger.info("Running post-ingest reflection")
        print("\n  🔄 Running post-ingest reflection...")
        run_reflection(last_n=1, suggest_skills=False, dry_run=False)
    except Exception as exc:
        logger.warning("Reflection skipped | error_type=%s error=%s", type(exc).__name__, exc)
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
        print("       Code files are ingested as plain text with optional AST analysis.")
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

    logger.info("Batch ingest start | total_files=%d resume=%s incremental=%s", len(unique_paths), resume, incremental)

    success_count = 0
    fail_count = 0
    for idx, p in enumerate(unique_paths, 1):
        try:
            logger.info("Processing file %d/%d | file=%s", idx, len(unique_paths), p.name)
            result = ingest(str(p), auto_convert=not no_convert, checkpoint=checkpoint)
            if result["success"]:
                success_count += 1
                logger.info("File ingested | file=%s title=%s slug=%s", p.name, result.get("title"), result.get("slug"))
            else:
                fail_count += 1
                logger.error("File ingest failed (result) | file=%s", p.name)
        except IngestError as e:
            fail_count += 1
            logger.error("File ingest failed (IngestError) | file=%s error=%s", p.name, e)
            print(f"  ❌ Failed: {p.name} ({e})")
            checkpoint[str(p.resolve())] = {
                "hash": _file_hash(p),
                "status": "failed",
                "timestamp": date.today().isoformat(),
            }
            _save_checkpoint(checkpoint)
        except Exception as e:
            fail_count += 1
            logger.exception("Unexpected error on file | file=%s error_type=%s error=%s", p.name, type(e).__name__, e)
            print(f"  ❌ Unexpected error on {p.name}: {e}")
            checkpoint[str(p.resolve())] = {
                "hash": _file_hash(p),
                "status": "failed",
                "timestamp": date.today().isoformat(),
            }
            _save_checkpoint(checkpoint)

    _save_checkpoint(checkpoint)
    logger.info("Batch ingest complete | success=%d failed=%d total=%d", success_count, fail_count, len(unique_paths))

    print(f"\n{'='*50}")
    print(f"Batch complete: {success_count} succeeded, {fail_count} failed")
    print(f"{'='*50}")
    if fail_count > 0:
        print(f"Run with --resume to retry failed files only.")
    sys.exit(0 if fail_count == 0 else 1)
