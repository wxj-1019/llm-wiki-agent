#!/usr/bin/env python3
"""Generate MCP Server from wiki content."""
from __future__ import annotations

import json
import logging
from io import StringIO
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.types import WikiPage

logger = logging.getLogger(__name__)


def _escape_py_string(s: str) -> str:
    """Escape a string for safe embedding in Python triple-quoted source."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def generate_mcp_server(
    pages: dict[str, WikiPage],
    graph_analysis: dict,
    config: dict,
    output_dir: Path,
) -> Path:
    """Generate all MCP server files."""
    output_dir.mkdir(parents=True, exist_ok=True)

    _generate_wiki_index(pages, output_dir)
    _generate_graph_client(output_dir)
    _generate_mcp_main(pages, output_dir)
    _generate_readme(output_dir)

    logger.info("MCP Server generated in %s", output_dir)
    return output_dir


def _generate_wiki_index(pages: dict[str, WikiPage], output_dir: Path) -> None:
    """Generate wiki_index.py with embedded search index."""
    from agent_kit.indexer import build_index

    index = build_index(pages)
    buf = StringIO()

    buf.write('#!/usr/bin/env python3\n')
    buf.write('"""Pre-built search index for wiki MCP server."""\n')
    buf.write("from collections import defaultdict\n\n\n")

    buf.write("def _tokenize(text: str) -> set[str]:\n")
    buf.write('    """Lightweight tokenizer: English words + Chinese bigrams."""\n')
    buf.write("    tokens = set()\n")
    buf.write("    import re\n")
    buf.write(r"    tokens.update(re.findall(r'\b[a-z]{3,}\b', text.lower()))" + "\n")
    buf.write(r"    for segment in re.findall(r'[\u4e00-\u9fff]+', text):" + "\n")
    buf.write("        for i in range(len(segment) - 1):\n")
    buf.write("            tokens.add(segment[i:i+2])\n")
    buf.write("    return tokens\n\n\n")

    # Page index
    buf.write("PAGE_INDEX = {\n")
    for slug, info in sorted(index.get("page_index", {}).items()):
        buf.write(f'    "{_escape_py_string(slug)}": {{\n')
        buf.write(f'        "title": "{_escape_py_string(info["title"])}",\n')
        # Strip leading "wiki/" so paths are relative to the wiki directory
        wiki_rel_path = info["path"].removeprefix("wiki/")
        buf.write(f'        "path": "{_escape_py_string(wiki_rel_path)}",\n')
        buf.write(f'        "type": "{_escape_py_string(info["type"])}",\n')
        buf.write(f'        "tags": {json.dumps(info.get("tags", []), ensure_ascii=False)},\n')
        buf.write(f'        "summary": "{_escape_py_string(info.get("summary", ""))}",\n')
        buf.write("    },\n")
    buf.write("}\n\n\n")

    # Inverted index
    buf.write("INVERTED_INDEX = {\n")
    for word, slugs in sorted(index.get("inverted", {}).items()):
        buf.write(f'    "{_escape_py_string(word)}": {json.dumps(slugs, ensure_ascii=False)},\n')
    buf.write("}\n\n\n")

    # Tag index
    buf.write("TAG_INDEX = {\n")
    for tag, slugs in sorted(index.get("tag_index", {}).items()):
        buf.write(f'    "{_escape_py_string(tag)}": {json.dumps(slugs, ensure_ascii=False)},\n')
    buf.write("}\n\n\n")

    # Type index
    buf.write("TYPE_INDEX = {\n")
    for typ, slugs in sorted(index.get("type_index", {}).items()):
        buf.write(f'    "{_escape_py_string(typ)}": {json.dumps(slugs, ensure_ascii=False)},\n')
    buf.write("}\n\n\n")

    # Search functions
    buf.write("def search_index(query: str, limit: int = 5) -> list[dict]:\n")
    buf.write('    """Pure inverted-index search, O(k) complexity."""\n')
    buf.write("    query_words = _tokenize(query)\n")
    buf.write("    scores = defaultdict(float)\n")
    buf.write("    for word in query_words:\n")
    buf.write("        for slug in INVERTED_INDEX.get(word, []):\n")
    buf.write("            scores[slug] += 1.0\n")
    buf.write("    sorted_slugs = sorted(scores.keys(), key=lambda s: scores[s], reverse=True)[:limit]\n")
    buf.write("    return [\n")
    buf.write("        {\n")
    buf.write('            "title": PAGE_INDEX[s]["title"],\n')
    buf.write('            "path": PAGE_INDEX[s]["path"],\n')
    buf.write('            "type": PAGE_INDEX[s]["type"],\n')
    buf.write('            "excerpt": PAGE_INDEX[s]["summary"],\n')
    buf.write('            "score": scores[s],\n')
    buf.write("        }\n")
    buf.write("        for s in sorted_slugs if s in PAGE_INDEX\n")
    buf.write("    ]\n\n\n")

    buf.write('def get_sources(tag: str = "all") -> list[dict]:\n')
    buf.write('    sources = [p for p in PAGE_INDEX.values() if p["type"] == "source"]\n')
    buf.write('    if tag != "all":\n')
    buf.write('        sources = [s for s in sources if tag in s.get("tags", [])]\n')
    buf.write("    return sources\n\n\n")

    buf.write("def get_entity(name: str) -> dict | None:\n")
    buf.write("    name_lower = name.lower()\n")
    buf.write('    for slug, info in PAGE_INDEX.items():\n')
    buf.write('        if info["type"] == "entity" and name_lower in slug.lower():\n')
    buf.write("            return info\n")
    buf.write("    return None\n\n\n")

    buf.write("def get_concept(name: str) -> dict | None:\n")
    buf.write("    name_lower = name.lower()\n")
    buf.write('    for slug, info in PAGE_INDEX.items():\n')
    buf.write('        if info["type"] == "concept" and name_lower in slug.lower():\n')
    buf.write("            return info\n")
    buf.write("    return None\n")

    (output_dir / "wiki_index.py").write_text(buf.getvalue(), encoding="utf-8")


def _generate_graph_client(output_dir: Path) -> None:
    """Generate graph_client.py."""
    code = '''#!/usr/bin/env python3
"""Knowledge graph query client."""
from pathlib import Path
from collections import defaultdict, deque
import json

GRAPH_PATH = Path(__file__).parent.parent.parent / "graph" / "graph.json"


class GraphClient:
    def __init__(self):
        self._graph = None
        self._adj = None

    def _load(self):
        if self._graph is not None:
            return
        if not GRAPH_PATH.exists():
            self._graph = {"nodes": [], "edges": []}
        else:
            try:
                self._graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self._graph = {"nodes": [], "edges": []}

        self._adj = defaultdict(list)
        for edge in self._graph.get("edges", []):
            src = edge.get("source")
            tgt = edge.get("target")
            if src and tgt:
                self._adj[src].append({
                    "target": tgt,
                    "relation": edge.get("relation", "related"),
                    "confidence": edge.get("confidence", 1.0),
                    "type": edge.get("type", "explicit"),
                })

    def find_neighbors(self, node: str, depth: int = 1) -> list[dict]:
        """BFS find neighbors up to given depth."""
        self._load()
        visited = {node}
        queue = deque([(node, 0)])
        results = []
        while queue:
            current, d = queue.popleft()
            if d >= depth:
                continue
            for edge in self._adj.get(current, []):
                target = edge["target"]
                if target not in visited:
                    visited.add(target)
                    queue.append((target, d + 1))
                    results.append({
                        "source": current,
                        "target": target,
                        "relation": edge["relation"],
                        "confidence": edge["confidence"],
                        "hops": d + 1,
                    })
        return results

    def get_centrality(self, top_n: int = 10) -> list[dict]:
        """Return top nodes by degree centrality."""
        self._load()
        degrees = defaultdict(int)
        for edge in self._graph.get("edges", []):
            degrees[edge.get("source", "")] += 1
            degrees[edge.get("target", "")] += 1
        sorted_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)
        return [{"node": n, "degree": d} for n, d in sorted_nodes[:top_n] if n]

    def find_path(self, start: str, end: str, max_depth: int = 4) -> list[dict]:
        """Find path between two nodes."""
        self._load()
        queue = deque([(start, [])])
        visited = {start}
        while queue:
            current, path = queue.popleft()
            if len(path) >= max_depth:
                continue
            for edge in self._adj.get(current, []):
                target = edge["target"]
                new_path = path + [{"from": current, "to": target, **edge}]
                if target == end:
                    return new_path
                if target not in visited:
                    visited.add(target)
                    queue.append((target, new_path))
        return []
'''
    (output_dir / "graph_client.py").write_text(code, encoding="utf-8")


def _generate_mcp_main(pages: dict[str, WikiPage], output_dir: Path) -> None:
    """Generate the main MCP server file."""
    buf = StringIO()

    buf.write('#!/usr/bin/env python3\n')
    buf.write('"""MCP Server for LLM Wiki — auto-generated."""\n')
    buf.write("from pathlib import Path\n")
    buf.write("from mcp.server.fastmcp import FastMCP\n")
    buf.write("import logging\n\n")

    buf.write("# ── Config ──\n")
    buf.write('WIKI_ROOT = Path(__file__).parent.parent.parent / "wiki"\n\n')

    buf.write("# STDIO transport: never write to stdout\n")
    buf.write("logging.basicConfig(\n")
    buf.write("    level=logging.INFO,\n")
    buf.write("    handlers=[logging.StreamHandler()],\n")
    buf.write(")\n")
    buf.write('logger = logging.getLogger("wiki-mcp")\n\n')
    buf.write('mcp = FastMCP("llm-wiki")\n\n\n')

    buf.write("# ── Helpers ──\n")
    buf.write("def read_wiki_page(rel_path: str) -> str:\n")
    buf.write('    """Safely read a wiki page."""\n')
    buf.write("    target = (WIKI_ROOT / rel_path).resolve()\n")
    buf.write("    # Path traversal guard\n")
    buf.write('    if not str(target).startswith(str(WIKI_ROOT.resolve())):\n')
    buf.write('        return "Error: Invalid path (path traversal detected)"\n')
    buf.write("    if not target.exists():\n")
    buf.write('        return f"Error: Page not found: {rel_path}"\n')
    buf.write('    return target.read_text(encoding="utf-8")\n\n\n')

    buf.write("# ── Resources ──\n")
    buf.write('@mcp.resource("wiki://overview")\n')
    buf.write("def resource_overview() -> str:\n")
    buf.write('    """Living synthesis across all sources in the wiki."""\n')
    buf.write('    return read_wiki_page("overview.md")\n\n')

    buf.write('@mcp.resource("wiki://index")\n')
    buf.write("def resource_index() -> str:\n")
    buf.write('    """Catalog of all pages in the wiki."""\n')
    buf.write('    return read_wiki_page("index.md")\n\n')

    # Type -> URI plural mapping
    _PLURAL = {"entity": "entities", "synthesis": "syntheses"}

    for slug, page in sorted(pages.items()):
        # Skip pages that already have hard-coded resources above
        if slug in ("overview", "index"):
            continue
        type_plural = _PLURAL.get(page["type"], page["type"] + "s")
        uri = f"wiki://{type_plural}/{slug}"
        func_name = f"resource_{slug.replace('-', '_')}"
        # page['path'] is 'wiki/concepts/X.md' relative to repo_root;
        # read_wiki_page expects path relative to wiki/ directory
        wiki_rel_path = page["path"].removeprefix("wiki/")
        buf.write(f'@mcp.resource("{_escape_py_string(uri)}")\n')
        buf.write(f"def {func_name}() -> str:\n")
        buf.write(f'    """{_escape_py_string(page["title"])}"""\n')
        buf.write(f'    return read_wiki_page("{_escape_py_string(wiki_rel_path)}")\n\n')

    buf.write("# ── Tools ──\n")
    buf.write("# Annotation mapping: readOnlyHint reflects whether the tool mutates state\n")
    buf.write("_RO = {'readOnlyHint': True, 'destructiveHint': False, 'openWorld': False}\n")
    buf.write("_RO_OPEN = {'readOnlyHint': True, 'destructiveHint': False, 'openWorld': True}\n\n")

    buf.write("@mcp.tool(annotations=_RO_OPEN)\n")
    buf.write("def search_wiki(query: str, limit: int = 5) -> list[dict]:\n")
    buf.write('    """Search wiki pages by keyword.\n\n')
    buf.write("    Args:\n")
    buf.write("        query: Search keywords (supports English and Chinese).\n")
    buf.write("        limit: Maximum number of results to return (default 5).\n")
    buf.write('    """\n')
    buf.write("    from wiki_index import search_index\n")
    buf.write("    return search_index(query, limit)\n\n")

    buf.write("@mcp.tool(annotations=_RO)\n")
    buf.write("def get_page(path: str) -> str:\n")
    buf.write('    """Read a specific wiki page by relative path.\n\n')
    buf.write("    Args:\n")
    buf.write("        path: Relative path within wiki/ (e.g. 'concepts/RAG.md').\n")
    buf.write('    """\n')
    buf.write("    return read_wiki_page(path)\n\n")

    buf.write("@mcp.tool(annotations=_RO)\n")
    buf.write("def get_overview() -> str:\n")
    buf.write('    """Get the living synthesis of the entire wiki knowledge base."""\n')
    buf.write('    return read_wiki_page("overview.md")\n\n')

    buf.write("@mcp.tool(annotations=_RO)\n")
    buf.write("def find_connections(topic: str, depth: int = 1) -> list[dict]:\n")
    buf.write('    """Find pages connected to a topic via knowledge graph edges.\n\n')
    buf.write("    Args:\n")
    buf.write("        topic: Node name/slug in the graph (e.g. 'Transformer').\n")
    buf.write("        depth: BFS depth (default 1, max 3 recommended).\n")
    buf.write('    """\n')
    buf.write("    from graph_client import GraphClient\n")
    buf.write("    client = GraphClient()\n")
    buf.write("    return client.find_neighbors(topic, depth)\n\n")

    buf.write("@mcp.tool(annotations=_RO)\n")
    buf.write('def list_sources(tag: str = "all") -> list[dict]:\n')
    buf.write('    """List all source documents in the wiki.\n\n')
    buf.write("    Args:\n")
    buf.write("        tag: Filter by tag, or 'all' for every source (default 'all').\n")
    buf.write('    """\n')
    buf.write("    from wiki_index import get_sources\n")
    buf.write("    return get_sources(tag)\n\n")

    buf.write("@mcp.tool(annotations=_RO_OPEN)\n")
    buf.write("def ask_wiki(question: str) -> str:\n")
    buf.write('    """Ask a question and get synthesized context from the wiki.\n\n')
    buf.write("    Args:\n")
    buf.write("        question: Natural language question.\n")
    buf.write('    """\n')
    buf.write("    from wiki_index import search_index\n")
    buf.write("    relevant = search_index(question, limit=3)\n")
    buf.write('    if not relevant:\n')
    buf.write('        return "No relevant information found in the wiki."\n')
    buf.write("    contexts = []\n")
    buf.write("    for page in relevant:\n")
    buf.write('        content = read_wiki_page(page["path"])\n')
    buf.write('        contexts.append(f"## {page[\'title\']}" + "\\n" + f"{content[:2000]}...")\n')
    buf.write('    return "\\n\\n---\\n\\n".join(contexts)\n\n\n')

    buf.write("# ── Prompts ──\n")
    buf.write("@mcp.prompt()\n")
    buf.write("def summarize_topic(topic: str) -> str:\n")
    buf.write('    return f"""Research the topic "{topic}" using the wiki knowledge base.\n\n')
    buf.write("Steps:\n")
    buf.write('1. Use search_wiki("{topic}") to find relevant pages\n')
    buf.write("2. Use get_page() to read the top 2-3 most relevant pages\n")
    buf.write("3. Synthesize a structured summary covering:\n")
    buf.write("   - Core definition\n")
    buf.write("   - Key claims or findings\n")
    buf.write("   - Related entities and concepts\n")
    buf.write("   - Connections to other topics (use find_connections if needed)\n\n")
    buf.write("Format your response with clear headings and inline citations like [[PageName]].\"\"\"\n\n")

    buf.write("@mcp.prompt()\n")
    buf.write("def compare_entities(a: str, b: str) -> str:\n")
    buf.write('    return f"""Compare "{a}" and "{b}" based on the wiki knowledge base.\n\n')
    buf.write("Steps:\n")
    buf.write("1. Use get_entity() or search_wiki() to find both entities\n")
    buf.write("2. Compare across these dimensions:\n")
    buf.write("   - Background / founding context\n")
    buf.write("   - Key contributions or products\n")
    buf.write("   - Relationships to other entities/concepts\n")
    buf.write("   - Timeline of major events\n")
    buf.write("3. Note any contradictions or competing narratives in the wiki.\n\n")
    buf.write("Format as a structured comparison table followed by narrative analysis.\"\"\"\n\n")

    buf.write("@mcp.prompt()\n")
    buf.write("def trace_evolution(concept: str) -> str:\n")
    buf.write('    return f"""Trace how the concept "{concept}" evolved according to the wiki.\n\n')
    buf.write("Steps:\n")
    buf.write('1. search_wiki("{concept}") to find all mentions\n')
    buf.write("2. Prioritize source pages (wiki/sources/*) for chronological evidence\n")
    buf.write("3. Identify key milestones and who contributed what\n")
    buf.write("4. Note paradigm shifts or contradictions over time\"\"\"\n\n\n")

    buf.write('if __name__ == "__main__":\n')
    buf.write('    mcp.run(transport="stdio")\n')

    (output_dir / "wiki_mcp_server.py").write_text(buf.getvalue(), encoding="utf-8")


def _generate_readme(output_dir: Path) -> None:
    readme = """# LLM Wiki MCP Server

Auto-generated MCP server for the LLM Wiki knowledge base.

## Quick Start

```bash
python wiki_mcp_server.py
```

## Available Tools

- `search_wiki(query, limit=5)` — Full-text search
- `get_page(path)` — Read a specific page
- `get_overview()` — Living synthesis
- `find_connections(topic, depth=1)` — Graph traversal
- `list_sources(tag="all")` — List sources
- `ask_wiki(question)` — RAG context retrieval

## Client Configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "python",
      "args": ["/ABSOLUTE/PATH/TO/llm-wiki-agent/agent-kit/mcp-server/wiki_mcp_server.py"]
    }
  }
}
```
"""
    (output_dir / "README.md").write_text(readme, encoding="utf-8")
