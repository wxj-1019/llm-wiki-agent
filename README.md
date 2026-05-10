# LLM Wiki Agent

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Agent-driven knowledge management.** Drop sources into `raw/`, tell the agent to ingest them — it extracts entities, concepts, and cross-references, building a structured interlinked wiki that compounds with every new source. Comes with a React frontend, full-text search, knowledge graph visualization, automation pipeline, and MCP/Skill export.

```
ingest raw/papers/attention-is-all-you-need.md
query: what are the main approaches to reducing hallucination?
health
build the knowledge graph
```

## What's Inside

```
wiki/               # Agent-maintained knowledge base (plain markdown)
  index.md           # Catalog of all pages
  overview.md        # Living synthesis across all sources
  log.md             # Append-only operation record
  sources/           # One summary page per ingested document
  entities/          # People, companies, projects — auto-created
  concepts/          # Ideas, frameworks, methods — auto-created
  syntheses/         # Saved query answers
  memory/            # Agent memory ledger (persistent task sessions)
graph/              # Knowledge graph (auto-generated)
  graph.json         # Node/edge data with community detection
  graph.html         # Self-contained interactive visualization
wiki-viewer/        # React + TypeScript frontend (Vite, Tailwind CSS 4)
tools/              # Standalone Python scripts
  agent_kit/         # MCP/Skill generators from wiki knowledge
  shared/            # Shared utilities (wiki ops, LLM config, graph HTML)
  fetchers/          # External content fetchers (RSS, arXiv, GitHub, web)
config/             # YAML configuration (LLM, scrapers, sources)
skills/             # Generated skill packages
mcp-servers/        # Generated MCP server packages
```

## Quick Start

```bash
git clone https://github.com/SamurAIGPT/llm-wiki-agent.git
cd llm-wiki-agent
```

### Using Claude Code (recommended)

Open the repo in Claude Code — it reads `CLAUDE.md` automatically:

```bash
claude
```

Slash commands available: `/wiki-ingest`, `/wiki-query`, `/wiki-health`, `/wiki-lint`, `/wiki-graph`, `/wiki-export`, `/wiki-reflect`, `/wiki-watch`

Or just use plain English — the agent understands natural language triggers.

### Using the Python Tools Directly

```bash
pip install litellm markitdown networkx

# Core wiki operations
python tools/ingest.py raw/my-article.md
python tools/query.py "what are the main themes?"
python tools/health.py --json
python tools/lint.py
python tools/build_graph.py --open

# Or use the unified CLI
python tools/cli.py ingest raw/my-article.md
python tools/cli.py search "transformer models"
python tools/cli.py server --port 8000
```

### Using the Web Frontend

```bash
# Start both servers (API + frontend)
python start_servers.py
# API → http://127.0.0.1:8000
# Frontend → http://localhost:3000

# Or start them separately
python tools/api_server.py &          # API on port 8000
cd wiki-viewer && npm run dev         # Dev server with HMR on port 3000
```

The frontend provides: wiki browsing with `[[wikilink]]` navigation, full-text search, interactive knowledge graph, Shiki syntax-highlighted markdown, i18n (en/zh-CN), and PWA offline support.

## Core Capabilities

### Ingest Pipeline

Drop files into `raw/` — the agent converts, extracts, and cross-references automatically:

- **Multi-format**: Markdown, PDF, DOCX, PPTX, XLSX, HTML, CSV, JSON, XML, RST, EPUB, IPYNB, and more — auto-converted via [markitdown](https://github.com/microsoft/markitdown)
- **Entity extraction**: Auto-creates pages for people, companies, projects mentioned across sources
- **Concept extraction**: Auto-creates pages for ideas, frameworks, methods
- **Contradiction flags**: New sources that conflict with existing claims are flagged at ingest time
- **Living synthesis**: `wiki/overview.md` is revised on every ingest

### Query & Synthesis

Ask natural language questions — the agent reads relevant wiki pages and synthesizes answers with inline citations as `[[wikilinks]]`. Answers can be saved as synthesis pages that compound like any other wiki content.

### Knowledge Graph

Two-pass build via `tools/build_graph.py`:

1. **Deterministic** — parses all `[[wikilinks]]` → `EXTRACTED` edges
2. **Semantic** — LLM infers implicit relationships → `INFERRED` edges with confidence scores

Includes Louvain community detection, SHA256 caching (only changed pages reprocess), and a self-contained `graph.html` visualization. Use `--report` for graph health analysis (orphan detection, god nodes, fragile bridges, phantom hubs).

### Full-Text Search

SQLite FTS5 engine with porter stemming and unicode61 tokenization (`tools/search_engine.py`). Powers the frontend search and MCP server. Optional semantic search via Ollama embeddings.

### Health & Lint

| Tool | Scope | LLM Cost | Frequency |
|---|---|---|---|
| `health.py` | Structural integrity (empty files, index sync, log coverage) | Zero | Every session |
| `lint.py` | Content quality (orphans, broken links, contradictions, gaps) | Tokens | Every 10-15 ingests |

### Automation Pipeline

```bash
# One-shot: run each step
python tools/fetchers/rss_fetcher.py      # RSS/Atom → raw-inbox
python tools/fetchers/arxiv_fetcher.py    # arXiv API → raw-inbox
python tools/fetchers/github_fetcher.py   # GitHub releases → raw-inbox
python tools/fetchers/web_fetcher.py      # Web scraping → raw-inbox
python tools/batch_compiler.py            # Group into weekly batches
python tools/batch_ingest.py              # Ingest batches into wiki
python tools/archive_stale.py             # Archive expired source pages

# Or run the scheduler daemon (cross-platform)
python tools/scheduler.py
```

Configure sources in `config/rss_sources.yaml`, `config/arxiv_sources.yaml`, `config/github_sources.yaml`, and `config/web_sources.yaml`.

### Web Scraping

LLM-powered content extraction from web pages (`tools/fetchers/web_fetcher.py` + `tools/fetchers/llm_extractor.py`). Uses trafilatura for fast extraction, falls back to LLM extraction with configurable prompts, quality thresholds, and rate limiting (`config/scraper_config.yaml`).

### File Watcher

```bash
python tools/watcher.py           # foreground — watch raw/ and auto-ingest
python tools/watcher.py --daemon  # background (detached)
python tools/watcher.py --once    # process existing files then exit
```

Debounces rapid file events and tracks file hashes to avoid re-ingesting unchanged files.

### Agent Memory

Persistent task memory across sessions (`tools/memory.py`):

```bash
python tools/memory.py start "Refactor auth module" --target wiki/concepts/Auth.md
python tools/memory.py update S-20260509-001 --notes "Added OAuth2 flow diagram"
python tools/memory.py finish S-20260509-001 --summary "Completed auth refactor"
python tools/memory.py list
```

### Post-Ingest Reflection

```bash
python tools/reflect.py                   # analyze last ingest pattern
python tools/reflect.py --last 3          # analyze last 3 ingests
python tools/reflect.py --suggest-skills  # suggest new skill extraction
```

### MCP & Skill Export

Export wiki knowledge as self-contained agent capability packages:

```bash
python tools/export_agent_kit.py          # → agent-kit/ (MCP server + Kimi Skill)
```

The generated MCP server exposes wiki pages as Resources, search as Tools, and common queries as Prompts — compatible with Claude Desktop, Cursor, and VS Code.

### Unified CLI

```bash
python tools/cli.py ingest <path>
python tools/cli.py search <query>
python tools/cli.py health --save
python tools/cli.py lint --save
python tools/cli.py build-graph --open
python tools/cli.py memory start "<goal>"
python tools/cli.py context build "<goal>"
python tools/cli.py server --port 8000
python tools/cli.py watch --daemon
```

## Testing

```bash
# Python backend
python tools/test_api.py                  # API smoke tests
python -m pytest tools/test_api_pytest.py -v
python -m pytest tools/test_p1_acceptance.py -v

# Frontend
cd wiki-viewer
npx vitest run                            # run once
npx vitest                                # watch mode
```

## Configuration

### LLM (`config/llm.yaml`, gitignored)

```yaml
model: deepseek/deepseek-chat
model_fast: deepseek/deepseek-chat
provider: deepseek
api_key: sk-xxx
```

All tools read from this file via `tools/shared/llm.py`. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`) override the config file.

### Web Scraper (`config/scraper_config.yaml`)

Controls LLM extraction prompts, quality thresholds (`min_content_length`, `llm_min_quality_score`), rate limiting (`max_concurrent`, `requests_per_minute`), and browser settings for JavaScript-heavy pages.

## Tech Stack

| Layer | Technology |
|---|---|
| **Language** | Python 3.10–3.13 |
| **LLM Gateway** | litellm (~1.83.10) — Claude, OpenAI, Gemini, DeepSeek |
| **Graph Analysis** | NetworkX (~3.6.1) — Louvain community detection |
| **Search** | SQLite FTS5 (full-text) + optional Ollama embeddings (semantic) |
| **MCP/Skills** | FastMCP + Jinja2 sandbox |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS 4 |
| **Frontend Libraries** | vis-network, Zustand, fuse.js, Shiki, react-markdown, i18next, PWA |
| **Automation** | schedule + feedparser + requests + trafilatura |
| **Conversion** | markitdown[all] (20+ formats) |

## Obsidian Integration

The wiki uses `[[wikilinks]]` throughout — open `wiki/` as an Obsidian vault for a naturally growing knowledge graph.

```bash
# Symlink wiki/ into your Obsidian vault
ln -sfn ~/llm-wiki-agent/wiki ~/your-obsidian-vault/wiki
```

**Recommended Obsidian settings:**
- **Graph View:** Filter out `index.md` and `log.md` (`-file:index.md -file:log.md`)
- **Dataview:** Query the YAML frontmatter the agent injects (`type: source`, `tags: [diary]`)

## Why Not RAG?

| RAG | LLM Wiki Agent |
|---|---|
| Re-derives knowledge every query | Compiles once, keeps current |
| Raw chunks as retrieval unit | Structured wiki pages with frontmatter |
| No cross-references | Cross-references pre-built via `[[wikilinks]]` |
| Contradictions surface at query time (maybe) | Flagged at ingest time |
| No accumulation between sessions | Every source compounds |

## Optional Dependencies

| Package | Used for |
|---|---|
| `markitdown[all]` | Auto-conversion of non-.md files |
| `networkx` | Louvain community detection in graph |
| `feedparser` | RSS/Atom feed fetching |
| `trafilatura` | Web page content extraction |
| `mcp` | MCP server (FastMCP) |
| `jinja2` | Skill template rendering |
| `pytest` | Python test runner |
| `Pillow` | Image description (`multimodal_ingest.py`) |

## License

MIT License — see [LICENSE](LICENSE) for details.
