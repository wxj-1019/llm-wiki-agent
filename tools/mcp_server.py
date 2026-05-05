#!/usr/bin/env python3
"""Wiki MCP Server — production-ready stdio server for LLM Wiki Agent.

Exposes wiki knowledge as MCP Resources, Tools, and Prompts.
Configure in Claude Desktop / Cursor / VS Code:

    {
      "mcpServers": {
        "llm-wiki": {
          "command": "python",
          "args": ["tools/mcp_server.py"]
        }
      }
    }
"""
from __future__ import annotations

import json
import logging
import os
import re
import signal
import subprocess
import sys
from pathlib import Path

# Silence stdout (MCP stdio transport requirement)
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wiki-mcp")

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"

_mcp_search_engine = None


def _get_mcp_search_engine():
    global _mcp_search_engine
    if _mcp_search_engine is None:
        from tools.search_engine import WikiSearchEngine
        _mcp_search_engine = WikiSearchEngine()
    return _mcp_search_engine
RAW = REPO / "raw"
META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}

# ── Lazy imports (fail gracefully if optional deps missing) ──

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    logger.error("mcp package not installed. Run: pip install mcp>=1.2.0")
    sys.exit(1)


# ── FastMCP setup ──

mcp = FastMCP("llm-wiki")


# ── Helpers ──

def _safe_wiki_path(rel: str) -> Path | None:
    """Resolve a repo-relative path, ensuring it stays within wiki/."""
    target = (REPO / rel).resolve()
    try:
        target.relative_to(WIKI.resolve())
    except ValueError:
        return None
    return target


def _read_page(rel_path: str) -> str:
    """Read a wiki page by repo-relative path."""
    p = _safe_wiki_path(rel_path)
    if p is None or not p.exists():
        return f"Error: Page not found or access denied: {rel_path}"
    try:
        return p.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        return f"Error: Could not read {rel_path}: {e}"


def _list_pages(page_type: str | None = None) -> list[dict]:
    """List wiki pages, optionally filtered by type."""
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in META_FILES:
            continue
        content = _read_page(str(p.relative_to(REPO)))
        if content.startswith("Error:"):
            continue
        fm_type_match = re.search(r'^type:\s*(\S+)', content, re.MULTILINE)
        fm_type = fm_type_match.group(1).strip('"\'') if fm_type_match else "unknown"
        if page_type and fm_type != page_type:
            continue
        fm_title_match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
        title = fm_title_match.group(1).strip() if fm_title_match else p.stem
        results.append({
            "path": str(p.relative_to(REPO)),
            "wiki_path": str(p.relative_to(WIKI)),
            "title": title,
            "type": fm_type,
        })
    return results


def _run_ingest(file_path: str) -> dict:
    """Run ingest.py on a file and return result."""
    target = (REPO / file_path).resolve()
    allowed_roots = [RAW.resolve(), (WIKI / "sources").resolve()]
    try:
        if not any(target.relative_to(r) is not None for r in allowed_roots):
            return {"success": False, "error": "File must be in raw/ or wiki/sources/"}
    except ValueError:
        return {"success": False, "error": "File must be in raw/ or wiki/sources/"}
    if not target.exists():
        return {"success": False, "error": f"File not found: {file_path}"}
    ingest_script = REPO / "tools" / "ingest.py"
    try:
        result = subprocess.run(
            [sys.executable, str(ingest_script), str(target)],
            capture_output=True,
            text=True,
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Ingest timed out after 5 minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Resources ──

@mcp.resource("wiki://overview")
def resource_overview() -> str:
    """Living synthesis across all sources in the wiki."""
    return _read_page("wiki/overview.md")


@mcp.resource("wiki://index")
def resource_index() -> str:
    """Catalog of all pages in the wiki."""
    return _read_page("wiki/index.md")


# ── Tools ──

@mcp.tool()
def wiki_search(query: str, limit: int = 5) -> str:
    """Search wiki pages by keyword.

    Args:
        query: Search keyword or phrase
        limit: Maximum number of results (default: 5)

    Returns:
        JSON list of matching pages with title, path, type, and excerpt.
    """
    try:
        engine = _get_mcp_search_engine()
        results = engine.search(query, limit)
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        logger.warning("FTS5 search failed in MCP, falling back to substring: %s", e)
        # Fallback substring search
        q_clean = query.lower()
        results = []
        for p in WIKI.rglob("*.md"):
            if p.name in META_FILES:
                continue
            try:
                content = p.read_text(encoding="utf-8")
            except Exception:
                continue
            if q_clean in content.lower():
                results.append({
                    "path": str(p.relative_to(REPO)),
                    "title": p.stem,
                    "type": "unknown",
                    "excerpt": content[:300].replace("\n", " "),
                })
            if len(results) >= limit:
                break
        return json.dumps(results, ensure_ascii=False)


@mcp.tool()
def wiki_read(path: str) -> str:
    """Read a specific wiki page by relative path.

    Args:
        path: Relative path within the repo (e.g. 'wiki/concepts/Transformer.md')

    Returns:
        Full markdown content of the page.
    """
    return _read_page(path)


@mcp.tool()
def wiki_write(path: str, content: str) -> str:
    """Create or overwrite a wiki page.

    Args:
        path: Relative path (must be within wiki/ and end with .md)
        content: Markdown content to write

    Returns:
        Success message or error.
    """
    if not path.endswith(".md"):
        return "Error: Path must end with .md"
    target = _safe_wiki_path(path)
    if target is None:
        return "Error: Path must be within wiki/ directory"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Successfully wrote {path}"
    except (OSError, UnicodeEncodeError) as e:
        return f"Error: Could not write {path}: {e}"


@mcp.tool()
def wiki_list(page_type: str = "") -> str:
    """List wiki pages, optionally filtered by type.

    Args:
        page_type: Filter by type: 'source', 'entity', 'concept', 'synthesis', or '' for all

    Returns:
        JSON list of pages with path, title, and type.
    """
    pages = _list_pages(page_type if page_type else None)
    return json.dumps(pages, ensure_ascii=False)


@mcp.tool()
def wiki_ingest(file_path: str) -> str:
    """Ingest a source file into the wiki.

    Args:
        file_path: Path to the source file (relative to repo root, e.g. 'raw/my-paper.pdf')

    Returns:
        JSON result with success status and output.
    """
    result = _run_ingest(file_path)
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
def wiki_memory_start(goal: str, target: str = "") -> str:
    """Start a new agent memory session for tracking a task.

    Args:
        goal: Description of the task goal
        target: Optional wiki page path being worked on

    Returns:
        Session ID for later updates.
    """
    try:
        import tools.memory as mem
        sid = mem.start(goal, target or None)
        return json.dumps({"success": True, "session_id": sid, "goal": goal}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)


@mcp.tool()
def wiki_memory_update(session_id: str, notes: str) -> str:
    """Update an active memory session with progress notes.

    Args:
        session_id: Session ID from wiki_memory_start
        notes: Progress notes or decisions made

    Returns:
        Success status.
    """
    try:
        import tools.memory as mem
        ok = mem.update(session_id, notes)
        return json.dumps({"success": ok}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)


@mcp.tool()
def wiki_memory_finish(session_id: str, summary: str) -> str:
    """Finish a memory session and record the summary.

    Args:
        session_id: Session ID from wiki_memory_start
        summary: Final summary of what was accomplished

    Returns:
        Success status.
    """
    try:
        import tools.memory as mem
        ok = mem.finish(session_id, summary)
        return json.dumps({"success": ok}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)


@mcp.tool()
def wiki_memory_list(status: str = "") -> str:
    """List agent memory sessions.

    Args:
        status: Filter by status — 'active', 'finished', or '' for all

    Returns:
        JSON list of sessions.
    """
    try:
        import tools.memory as mem
        sessions = mem.list_sessions(status if status else None)
        return json.dumps(sessions, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)


@mcp.tool()
def wiki_context_build(goal: str, target: str = "", budget: int = 8000) -> str:
    """Build a token-bounded context pack from wiki knowledge.

    Args:
        goal: The task or question to build context for
        target: Optional starting wiki page path
        budget: Maximum estimated tokens (default 8000)

    Returns:
        Markdown context pack with relevant pages.
    """
    try:
        import tools.context as ctx
        pack = ctx.build(goal, target or None, budget)
        return pack
    except Exception as e:
        return f"Error building context: {e}"


# ── Prompts ──

@mcp.prompt()
def summarize_topic(topic: str) -> str:
    """Generate a structured summary of a topic from the wiki."""
    return f"""Research the topic "{topic}" using the wiki knowledge base.

Steps:
1. Use wiki_search("{topic}") to find relevant pages
2. Use wiki_read() to read the top 2-3 most relevant pages
3. Synthesize a structured summary covering:
   - Core definition
   - Key claims or findings
   - Related entities and concepts
   - Connections to other topics

Format your response with clear headings and inline citations like [[PageName]]."""


@mcp.prompt()
def compare_entities(a: str, b: str) -> str:
    """Compare two entities from the wiki knowledge base."""
    return f"""Compare "{a}" and "{b}" based on the wiki knowledge base.

Steps:
1. Use wiki_search("{a}") and wiki_search("{b}") to find their pages
2. Use wiki_read() to read both pages
3. Compare across dimensions:
   - Background / founding context
   - Key contributions or products
   - Relationships to other entities/concepts
   - Timeline of major events
4. Note any contradictions or competing narratives.

Format as a structured comparison table followed by narrative analysis."""


@mcp.prompt()
def find_contradictions(topic: str = "all") -> str:
    """Find contradictions in the wiki knowledge base."""
    scope = f"on '{topic}'" if topic != "all" else "across the entire wiki"
    return f"""Find contradictions or conflicting claims {scope}.

Steps:
1. Use wiki_search() to find relevant pages
2. Look for:
   - Direct contradictions between sources
   - Outdated information that conflicts with newer sources
   - Different perspectives on the same event/claim
3. For each contradiction found, report:
   - The conflicting claims
   - The sources (pages) where they appear
   - Which source is more recent or authoritative

Be precise — only report actual contradictions, not minor differences in wording."""


# ── Signal handling ──

def _shutdown(signum, frame):
    logger.info("Received signal %s, shutting down...", signum)
    sys.exit(0)

signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)
if hasattr(signal, 'SIGBREAK'):
    signal.signal(signal.SIGBREAK, _shutdown)  # Windows

# ── Entrypoint ──

if __name__ == "__main__":
    mcp.run(transport="stdio")
