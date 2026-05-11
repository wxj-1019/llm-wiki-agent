# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# LLM Wiki Agent — Schema & Workflow Instructions

This wiki is maintained entirely by Claude Code. No API key or Python scripts needed — just open this repo in Claude Code and talk to it.

## Technology Stack

| Layer | Technology |
|---|---|
| **Language** | Python 3.10–3.13 |
| **Package Manager** | Poetry (`pyproject.toml`) |
| **Core Dependencies** | `markitdown[all]` (auto-conversion of 20+ formats), `tqdm` (progress bars) |
| **LLM Gateway** | `litellm` (~1.83.10) — universal API for Claude, OpenAI, Gemini, etc. |
| **Graph Analysis** | `networkx` (~3.6.1) — Louvain community detection |
| **Visualization** | Self-contained HTML with vis.js (CDN-loaded, no server needed) |
| **Search** | SQLite FTS5 (full-text) + optional Ollama embeddings (semantic) |
| **MCP/Skills** | `mcp` (FastMCP) + `jinja2` (skill templates) |
| **Frontend** | React 18 + TypeScript + Vite (`wiki-viewer/`), Tailwind CSS 4, vis-network, Zustand, PWA, vitest |
| **Automation** | `schedule` (daemon) + `feedparser`/`requests`/`trafilatura` (fetchers) |

**LLM Configuration:** `config/llm.yaml` is the central LLM config (model, provider, api_key, model_fast). All tools read from it via `tools/shared/llm.py`. This file is gitignored — never commit API keys.

**Environment Variables** (override `config/llm.yaml`):
- `LLM_MODEL` — model identifier passed to litellm (falls back to `config/llm.yaml`)
- Provider-specific API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, etc.)
- `GITHUB_TOKEN` — GitHub personal access token for higher rate limits in `github_fetcher.py`
- `OLLAMA_URL` — Ollama server URL for local embeddings/chat (default: `http://localhost:11434`)

**Security:** `litellm` is pinned to `~=1.83.10` in `requirements.txt` because versions `1.82.7–1.82.8` were compromised in a supply chain attack (March 2026). Never downgrade this dependency. All tools sanitize LLM-generated filenames against path traversal. `graph/graph.html` escapes `</script>` sequences to prevent XSS from wiki content.

## Slash Commands (Claude Code)

| Command | What to say |
|---|---|
| `/wiki-ingest` | `ingest raw/my-article.md` |
| `/wiki-query` | `query: what are the main themes?` |
| `/wiki-health` | `health` (fast, every session) |
| `/wiki-lint` | `lint the wiki` (expensive, periodic) |
| `/wiki-graph` | `build the knowledge graph` |
| `/wiki-export` | `export agent kit` (generates MCP server + skill package) |
| `/wiki-reflect` | `reflect on recent ingests` |
| `/wiki-watch` | `watch raw/ for changes` |

Or just describe what you want in plain English:
- *"Start the watcher as a daemon"*
- *"Export the wiki as an MCP server"*
- *"Run the API smoke tests"*

Claude Code reads this file automatically and follows the workflows below.

---

## Directory Layout

```
raw/          # Immutable source documents — never modify these
raw-inbox/    # Automation pipeline staging area
  fetched/    #   Fetcher output: one .md per item (rss/, arxiv/, github/, web/)
  batches/    #   Compiled weekly batches ready for ingest
    archived/ #   Successfully ingested batches moved here
  state.json  #   Dedup state, processed URLs, last-run timestamps
config/       # Configuration (YAML)
  llm.yaml              # LLM provider/model/API key (gitignored)
  rss_sources.yaml
  arxiv_sources.yaml
  github_sources.yaml
  web_sources.yaml      # Web scraping target URLs
  scraper_config.yaml   # LLM crawler behavior (extraction prompts, rate limits, quality thresholds)
wiki/         # Claude owns this layer entirely
  index.md    # Catalog of all pages — update on every ingest
  log.md      # Append-only chronological record
  overview.md # Living synthesis across all sources
  sources/    # One summary page per source document
  entities/   # People, companies, projects, products
  concepts/   # Ideas, frameworks, methods, theories
  syntheses/  # Saved query answers
  memory/     # Agent memory ledger (persistent task memory sessions)
graph/        # Auto-generated graph data
  graph.json          # Node/edge data (SHA256-cached)
  graph.html          # Interactive vis.js visualization
  .cache.json         # Inference cache
  .inferred_edges.jsonl  # Checkpoint for resume
  .refresh_cache.json    # Refresh operation cache
state/        # Runtime state (gitignored)
  search.db   # SQLite FTS5 index
tools/        # Standalone Python scripts
  agent_kit/  # Agent Kit package (MCP generator, skill generator, embedder, indexer, etc.)
  shared/     # Shared utilities (wiki.py, llm.py, log.py, paths.py, graph_html.py)
  fetchers/   # External content fetchers (rss, arxiv, github, web, llm_extractor)
wiki-viewer/  # React + TypeScript wiki browser (Vite, Tailwind CSS 4, PWA)
skills/       # Installed skill definitions (generated from wiki knowledge)
mcp-servers/  # Installed MCP server runtimes (generated from wiki knowledge)
agent-kit/    # Export output directory (gitignored)
```

---

## Tools Reference

All scripts in `tools/` are standalone and require `litellm` (and optionally `markitdown`/`networkx`).

### Core Wiki Tools

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `ingest.py` | Ingest source documents into wiki | Yes | `python tools/ingest.py <path>` — auto-converts non-.md files; supports batch, `--no-convert`, `--validate-only` |
| `query.py` | Query wiki and synthesize answers | Yes | `python tools/query.py "<question>" [--save [<path>]]` |
| `lint.py` | Content quality checks | Yes (semantic) | `python tools/lint.py [--save]` — orphans, broken links, contradictions, missing entities, sparse pages, data gaps |
| `health.py` | Structural integrity checks | **No** | `python tools/health.py [--save] [--json]` — empty stubs, index sync, log coverage |
| `build_graph.py` | Knowledge graph generation | Yes (inference) | `python tools/build_graph.py [--no-infer] [--open] [--report]` — two-pass build with Louvain clustering |
| `heal.py` | Auto-heal missing entity pages | Yes | `python tools/heal.py` — scans for missing entities and generates pages from context |
| `refresh.py` | Refresh stale source pages | Yes (via ingest) | `python tools/refresh.py [--force] [--page sources/X]` — hash-based change detection |
| `pdf2md.py` | PDF/arXiv → Markdown conversion | No | `python tools/pdf2md.py <arxiv-id/url/pdf> [--backend marker\|pymupdf4llm]` |
| `file_to_md.py` | Batch directory conversion | No | `python tools/file_to_md.py --input_dir <dir> [--delete_source]` |
| `api_server.py` | Local FastAPI server for wiki viewer | No | `python tools/api_server.py [--host 127.0.0.1] [--port 8666]` |

### Automation Pipeline Tools

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `scheduler.py` | Cross-platform daemon that runs the full pipeline on a schedule | No | `python tools/scheduler.py` — runs fetchers → compile → ingest → maintenance at preset times |
| `batch_compiler.py` | Groups fetched .md files into weekly batches, deduplicating by URL | No | `python tools/batch_compiler.py [--window daily\|weekly] [--dry-run]` |
| `batch_ingest.py` | Calls `ingest.py` for each batch, archives on success, updates state | Yes (via ingest) | `python tools/batch_ingest.py [--dry-run] [--skip-archive]` |
| `archive_stale.py` | Moves expired source pages to `wiki/sources/archive/` based on `ttl:` or `archive_after:` frontmatter | No | `python tools/archive_stale.py [--dry-run] [--save-report]` |
| `auto_ingest.py` | Directly converts `raw-inbox/fetched/` .md files into structured `wiki/sources/` pages (bypasses batch pipeline) | **No** | `python tools/auto_ingest.py [--source web] [--dry-run] [--file <path>]` |
| `refresh_monitor.py` | Monitors wiki source pages for upstream changes via HEAD + ETag/Last-Modified, triggers re-fetch + re-ingest | No | `python tools/refresh_monitor.py [--source web] [--dry-run] [--force] [--max-age-hours 6]` |

### Fetchers (`tools/fetchers/`)

| Script | Purpose | Usage |
|---|---|---|
| `rss_fetcher.py` | Fetches RSS/Atom feeds → `raw-inbox/fetched/rss/` | `python tools/fetchers/rss_fetcher.py [--config config/rss_sources.yaml]` |
| `arxiv_fetcher.py` | Queries arXiv API → `raw-inbox/fetched/arxiv/` | `python tools/fetchers/arxiv_fetcher.py [--config config/arxiv_sources.yaml]` |
| `github_fetcher.py` | Fetches GitHub repo info/releases → `raw-inbox/fetched/github/` | `python tools/fetchers/github_fetcher.py [--config config/github_sources.yaml]` |

Fetchers require: `pip install feedparser requests trafilatura`.

### Web Scraping Pipeline

| Script | Purpose | Usage |
|---|---|---|
| `fetchers/web_fetcher.py` | Fetches web pages via HTTP + trafilatura → `raw-inbox/fetched/web/` | `python tools/fetchers/web_fetcher.py [--config config/web_sources.yaml]` |
| `fetchers/llm_extractor.py` | LLM-powered content extraction from raw HTML (uses prompts from `scraper_config.yaml`) | Called by `web_fetcher.py` when trafilatura is insufficient |

Web scraper behavior is controlled by `config/scraper_config.yaml`: browser settings, LLM extraction prompts (content_extraction, summarization, entity_extraction), quality thresholds, rate limiting, and dedup. Uses `claude-haiku-4-5` for extraction with `claude-sonnet-4-6` as fallback for complex pages.

### Search & Context Tools

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `search_engine.py` | SQLite FTS5 full-text search + optional Ollama semantic search | No | Imported by `api_server.py`, `mcp_server.py`, and `query.py` |
| `context.py` | Token-bounded context pack builder for agents | No | `python tools/context.py build "<goal>" [--target <page>] [--budget 8000]` |

### Agent Memory & Reflection

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `memory.py` | Persistent task memory ledger (start/update/finish/resume sessions) | No | `python tools/memory.py start "<goal>"` / `list` / `resume <id>` |
| `reflect.py` | Post-ingest reflection — analyzes ingest patterns, suggests skill extraction | Yes | `python tools/reflect.py [--last N] [--suggest-skills] [--dry-run]` |

### MCP & Skills

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `mcp_server.py` | MCP stdio server exposing wiki as Resources/Tools/Prompts | No | Configure in Claude Desktop / Cursor / VS Code MCP settings |
| `mcp_manager.py` | MCP server runtime manager (install/start/stop/list lifecycle) | No | `python tools/mcp_manager.py` (programmatic API) |
| `skill_engine.py` | Skill execution engine with Jinja2 sandbox | No | `python tools/skill_engine.py` (programmatic API) |
| `export_agent_kit.py` | Export wiki → MCP Server and/or Kimi Skill packages | No | `python tools/export_agent_kit.py [--output agent-kit]` |

### Automation & Utilities

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `cli.py` | Unified CLI — `wiki ingest/search/health/lint/build-graph/memory/context/server/watch` | Varies | `python tools/cli.py <command>` (or `wiki` if on PATH) |
| `watcher.py` | File system watcher — auto-ingests files added to `raw/` | Yes (via ingest) | `python tools/watcher.py [--daemon\|--once]` |
| `multimodal_ingest.py` | Describe images/PDFs via vision API (Gemini/Claude) | Yes | `python tools/multimodal_ingest.py describe <image>` |
| `ollama_client.py` | Local LLM fallback for embeddings and chat (Ollama) | No | Imported by `search_engine.py` and `embedder.py` |
| `check_i18n.py` | Check i18n completeness — missing keys, hardcoded strings | No | `python tools/check_i18n.py` |

### Shared Utilities (`tools/shared/`)

Centralizes common operations to eliminate duplication across tools. No LLM calls here.

| Module | Purpose |
|---|---|
| `wiki.py` | Read/write wiki pages, extract wikilinks, scan wiki directory, parse frontmatter |
| `llm.py` | Load config from `config/llm.yaml`, call litellm with retry/fallback |
| `log.py` | Structured logging for wiki operations |
| `paths.py` | Canonical path resolution (normalizes Windows/Unix paths) |
| `logging_config.py` | Shared logging configuration |
| `graph_html.py` | Generate `graph/graph.html` from `graph.json` (vis.js template) |

### Agent Kit (`tools/agent_kit/`)

Generates self-contained agent capability packages (MCP Servers, Kimi Skills) from wiki knowledge.

| Module | Purpose |
|---|---|
| `mcp_generator.py` | Generate MCP server files from wiki pages + graph analysis |
| `skill_generator.py` | Generate Kimi Skill files with template-based page rendering |
| `embedder.py` | Generate embeddings for wiki pages (via Ollama or API) |
| `indexer.py` | Build searchable wiki index for agent kits |
| `graph_analyzer.py` | Analyze graph.json — top nodes, communities, bridges |
| `diagram_generator.py` | Generate architecture diagrams from wiki structure |
| `parser.py` | Parse wiki pages into structured data |
| `triage.py` | Triage pages by quality/completeness for kit generation |
| `validators.py` | Validate generated kit files |
| `schema.py` | Schema definitions for agent kit output format |
| `state.py` | Track generation state for incremental updates |
| `types.py` | Shared type definitions (`WikiPage`, `GraphNode`, etc.) |
| `config.py` | Agent kit configuration management |

---

## Testing

### Python (backend)

```bash
# API smoke tests (requires api_server running on port 8666)
python tools/test_api.py

# pytest-based API tests
python -m pytest tools/test_api_pytest.py -v

# P1 acceptance tests
python -m pytest tools/test_p1_acceptance.py -v
```

### Frontend (vitest + testing-library)

```bash
cd wiki-viewer
npx vitest run              # run all tests once
npx vitest                  # watch mode
npx vitest --coverage       # with coverage
```

Frontend tests live in `wiki-viewer/src/**/*.test.{ts,tsx}`. Test setup (`src/test/setup.ts`) mocks SpeechSynthesisUtterance, matchMedia, and localStorage for jsdom.

---

## Wiki Viewer (React Frontend)

The `wiki-viewer/` directory contains a React + TypeScript + Vite frontend for browsing the wiki. It connects to `api_server.py` on port 8666.

```bash
cd wiki-viewer
npm install        # install dependencies (one-time)
npm run dev        # development server with HMR (port 3666, proxies /api → 8666)
npm run build      # production build → wiki-viewer/dist/
npm run preview    # preview production build (port 3666)
npm run lint       # ESLint with max-warnings 0
npx vitest run     # run tests once
npx vitest         # watch mode
```

Or use the convenience script to start both servers at once:
```bash
python start_servers.py    # starts api_server (port 8666) + vite preview (port 3666)
```

Tech: React 18, React Router 7, Tailwind CSS 4, Zustand (state), fuse.js (search), vis-network (graph), Shiki (syntax highlighting), react-markdown + remark-gfm, i18next (i18n with en/zh-CN), PWA (vite-plugin-pwa with Workbox caching), framer-motion (animations), DOMPurify (XSS sanitization), vitest + @testing-library/react (tests).

### Frontend Architecture

```
wiki-viewer/src/
├── main.tsx            # React entry point
├── router.tsx          # React Router route definitions (/, /browse, /page/:name, /search, /graph, /log)
├── index.css           # Tailwind + Apple x Warm Clay design tokens
├── components/
│   ├── content/        # MarkdownRenderer (Shiki + remark-gfm), WikiLink ([[wikilink]] resolver)
│   ├── graph/          # vis-network graph visualization
│   ├── layout/         # RootLayout, Sidebar, GlassHeader (Apple glassmorphism style)
│   ├── pages/          # HomePage, BrowsePage, PageDetailPage, SearchPage, GraphPage, LogPage, NotFoundPage
│   └── ui/             # Shared UI primitives
├── hooks/              # useDocumentTitle (syncs <title> to current page)
├── i18n/               # i18next setup + locales (en.json, zh-CN.json)
├── lib/                # frontmatter parser, wikilink resolver, fuse.js search, constants
├── services/           # dataService.ts — API client for api_server.py
├── stores/             # wikiStore.ts — Zustand store (pages, search, graph, selected page)
└── types/              # TypeScript interfaces (graph types, vis-network declaration)
```

**State flow:** `dataService.ts` fetches from `api_server.py` → `wikiStore.ts` (Zustand) holds normalized page data, search results, and graph state → React components subscribe via Zustand selectors.

**Routing:** `router.tsx` uses React Router BrowserRouter with hash history for static deployment compatibility. Routes: `/` (HomePage), `/browse` (BrowsePage), `/page/:name` (PageDetailPage), `/search` (SearchPage), `/graph` (GraphPage), `/log` (LogPage).

---

## Automation Pipeline

The pipeline automatically fetches content from external sources, compiles it into batches, ingests it into the wiki, and performs periodic maintenance.

```
External Sources              Staging                      Wiki
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ RSS / Atom   │ →   │ raw-inbox/fetched/  │ →   │ auto_ingest.py   │ → wiki/sources/
│ arXiv API    │ →   │   rss/ arxiv/       │ →   │ (fast path)      │
│ GitHub API   │ →   │   github/ web/      │ →   │                  │
│ Web Scraper  │ →   └─────────────────────┘     │ OR (legacy):     │
└──────────────┘                                 │ batch_compiler   │
                                                 │ → batch_ingest   │
                                                 │ → ingest.py      │
                                                 └──────────────────┘

Refresh Monitoring (twice daily):
  refresh_monitor.py → HEAD+ETag check → re-fetch if changed → auto_ingest.py

Maintenance (weekly):
  archive_stale.py → health.py → build_graph.py
```

### Pipeline Steps

1. **Fetch** — Fetchers write single-item `.md` files with frontmatter to `raw-inbox/fetched/<source>/`
2. **Auto-Ingest** (fast path) — `auto_ingest.py` directly converts fetched .md files into `wiki/sources/` structured pages, updating `wiki/index.md` and `wiki/log.md`. No LLM calls, no batch overhead.
3. **Compile** (legacy path) — `batch_compiler.py` groups by `(source_type, week)`, deduplicates by `source_url`, writes `raw-inbox/batches/batch-<type>-<week>.md`
4. **Ingest** (legacy path) — `batch_ingest.py` calls `ingest.py` for each batch, moves successful ones to `batches/archived/`
5. **Refresh Monitor** — `refresh_monitor.py` checks wiki source pages for upstream changes via HEAD + ETag/Last-Modified twice daily, triggers re-fetch + auto-re-ingest when content changes
6. **Maintain** — `archive_stale.py` archives expired sources (based on `ttl:` or `archive_after:` frontmatter), then `health.py` + `build_graph.py`

### Running the Pipeline

```bash
# One-shot: fetch → auto-ingest (recommended fast path)
python tools/fetchers/web_fetcher.py --config config/web_sources.yaml
python tools/auto_ingest.py --source web

# Legacy batch path (for LLM-powered deep ingest)
python tools/fetchers/rss_fetcher.py
python tools/batch_compiler.py --dry-run    # preview first
python tools/batch_compiler.py              # compile for real
python tools/batch_ingest.py --dry-run      # preview first
python tools/batch_ingest.py                # ingest for real

# Refresh monitoring: check for upstream changes
python tools/refresh_monitor.py --dry-run   # preview
python tools/refresh_monitor.py             # check & re-fetch changed

# Or run the scheduler daemon (cross-platform, no cron needed)
python tools/scheduler.py
```

The scheduler default schedule: GitHub daily at 00:00, RSS+auto-ingest at 08:00, arXiv+auto-ingest at 08:30, Web+auto-ingest at 08:45, refresh monitor at 14:00 and 20:00, maintenance Sun 22:00. Edit `scheduler.py` to adjust.

### Archival

Source pages can declare auto-expiry in frontmatter:
- `ttl: 30` — expire N days after `last_updated` or `date`
- `archive_after: 2026-06-01` — expire after a specific date

Expired pages move to `wiki/sources/archive/` and are removed from `index.md`. Entity and concept pages are never archived.

---

## Page Format

Every wiki page uses this frontmatter:

```yaml
---
title: "Page Title"
type: source | entity | concept | synthesis
tags: []
sources: []       # list of source slugs that inform this page
last_updated: YYYY-MM-DD
---
```

Use `[[PageName]]` wikilinks to link to other wiki pages.

---

## Ingest Workflow

Triggered by: *"ingest <file>"* or `/wiki-ingest`

**Supported formats:** Markdown (`.md`) ingested directly. Non-markdown files (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.html`, `.txt`, `.csv`, `.json`, `.xml`, `.rst`, `.rtf`, `.epub`, `.ipynb`, `.yaml`, `.yml`, `.tsv`, `.wav`, `.mp3`) auto-converted to markdown via [markitdown](https://github.com/microsoft/markitdown) before ingestion. Use `--no-convert` to skip auto-conversion.

Steps (in order):
1. Read the source document fully using the Read tool (auto-convert if non-markdown)
2. Read `wiki/index.md` and `wiki/overview.md` for current wiki context
3. Write `wiki/sources/<slug>.md` — use the source page format below
4. Update `wiki/index.md` — add entry under Sources section
5. Update `wiki/overview.md` — revise synthesis if warranted
6. Update/create entity pages for key people, companies, projects mentioned
7. Update/create concept pages for key ideas and frameworks discussed
8. Flag any contradictions with existing wiki content
9. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <Title>`
10. **Post-ingest validation** — check for broken `[[wikilinks]]`, verify all new pages are in `index.md`, print a change summary

### Source Page Format

```markdown
---
title: "Source Title"
type: source
tags: []
date: YYYY-MM-DD
source_file: raw/...
---

## Summary
2–4 sentence summary.

## Key Claims
- Claim 1
- Claim 2

## Key Quotes
> "Quote here" — context

## Connections
- [[EntityName]] — how they relate
- [[ConceptName]] — how it connects

## Contradictions
- Contradicts [[OtherPage]] on: ...
```

### Domain-Specific Templates

If the source falls into a specific domain (e.g., personal diary, meeting notes), the agent should use a specialized template instead of the default generic one above:

#### Diary / Journal Template
```markdown
---
title: "YYYY-MM-DD Diary"
type: source
tags: [diary]
date: YYYY-MM-DD
---
## Event Summary
...
## Key Decisions
...
## Energy & Mood
...
## Connections
...
## Shifts & Contradictions
...
```

#### Meeting Notes Template
```markdown
---
title: "Meeting Title"
type: source
tags: [meeting]
date: YYYY-MM-DD
---
## Goal
...
## Key Discussions
...
## Decisions Made
...
## Action Items
...
```

---

## Query Workflow

Triggered by: *"query: <question>"* or `/wiki-query`

Steps:
1. Read `wiki/index.md` to identify relevant pages
2. Read those pages with the Read tool
3. Synthesize an answer with inline citations as `[[PageName]]` wikilinks
4. Ask the user if they want the answer filed as `wiki/syntheses/<slug>.md`

---

## Lint Workflow

Triggered by: *"lint the wiki"* or `/wiki-lint`

Use Grep and Read tools to check for:
- **Orphan pages** — wiki pages with no inbound `[[links]]` from other pages
- **Broken links** — `[[WikiLinks]]` pointing to pages that don't exist
- **Contradictions** — claims that conflict across pages
- **Stale summaries** — pages not updated after newer sources
- **Missing entity pages** — entities mentioned in 3+ pages but lacking their own page
- **Sparse pages** — pages with fewer than 2 outbound `[[wikilinks]]` (link density budget)
- **Data gaps** — questions the wiki can't answer; suggest new sources

Graph-aware checks (require `graph.json` from `build_graph.py`):
- **Hub stubs** — god nodes (degree > μ+2σ) with thin content (< 500 chars)
- **Fragile bridges** — community pairs connected by only 1 edge
- **Isolated communities** — clusters with zero external connections

Output a lint report and ask if the user wants it saved to `wiki/lint-report.md`.

---

## Health Workflow

Triggered by: *"health"* or `/wiki-health`

Run: `python tools/health.py` (or `python tools/health.py --json` for machine-readable output)

Fast structural integrity checks — **zero LLM calls**, safe to run every session:
- **Empty / stub files** — pages with no content beyond frontmatter (rate-limit damage)
- **Index sync** — `wiki/index.md` entries vs actual files on disk
- **Log coverage** — source pages missing a corresponding `ingest` entry in `wiki/log.md`

Output a health report. Use `--save` to write to `wiki/health-report.md`.

### Health vs Lint Boundary

| Dimension | `health` | `lint` |
|---|---|---|
| **Scope** | Structural integrity | Content quality |
| **LLM calls** | Zero | Yes (semantic analysis) |
| **Cost** | Free | Tokens |
| **Frequency** | Every session, before other work | Every 10-15 ingests |
| **Checks** | Empty files, index sync, log sync | Orphans, broken links, contradictions, gaps |
| **Tool** | `tools/health.py` | `tools/lint.py` |
| **Run order** | First (pre-flight) | After health passes |

> Run `health` first — linting an empty file wastes tokens.

---

## Graph Workflow

Triggered by: *"build the knowledge graph"* or `/wiki-graph`

When the user asks to build the graph, run `tools/build_graph.py` which:
- Pass 1: Parses all `[[wikilinks]]` → deterministic `EXTRACTED` edges
- Pass 2: Infers implicit relationships → `INFERRED` edges with confidence scores
- Runs Louvain community detection
- Outputs `graph/graph.json` + `graph/graph.html`

If the user doesn't have Python/dependencies set up, instead generate the graph data manually:
1. Use Grep to find all `[[wikilinks]]` across wiki pages
2. Build a node/edge list
3. Write `graph/graph.json` directly
4. Write `graph/graph.html` using the vis.js template

### Graph Health Report

Triggered by: `python tools/build_graph.py --report`

The `--report` flag generates a structured graph health report covering:
- **Health summary** — edges/node ratio, orphan %, community count, link density
- **Orphan nodes** — pages with zero graph connections
- **God nodes** — hub pages with degree > μ+2σ (disproportionate connectivity)
- **Fragile bridges** — community pairs connected by only 1 edge
- **Phantom hubs** — `[[wikilinks]]` referenced by 2+ existing pages but pointing to non-existent pages (page creation signals)

Use `--save` to write the report to `graph/graph-report.md`.

---

## Naming Conventions

- Source slugs: `kebab-case` matching source filename
- Entity pages: `TitleCase.md` (e.g. `OpenAI.md`, `SamAltman.md`)
- Concept pages: `TitleCase.md` (e.g. `ReinforcementLearning.md`, `RAG.md`)
- Source pages: `kebab-case.md`

## Index Format

```markdown
# Wiki Index

## Overview
- [Overview](overview.md) — living synthesis

## Sources
- [Source Title](sources/slug.md) — one-line summary

## Entities
- [Entity Name](entities/EntityName.md) — one-line description

## Concepts
- [Concept Name](concepts/ConceptName.md) — one-line description

## Syntheses
- [Analysis Title](syntheses/slug.md) — what question it answers
```

## Log Format

Each entry starts with `## [YYYY-MM-DD] <operation> | <title>` so it's grep-parseable:

```
grep "^## \[" wiki/log.md | tail -10
```

Operations: `ingest`, `query`, `health`, `lint`, `graph`

---

## Phase 3 Design Constraints (Auto-Linking — Open)

Phase 3 proposes automatic `[[wikilink]]` insertion based on graph analysis. The following hard rules apply:

### Promotion Gate: `draft → stable`
- Auto-linked edges start as `DRAFT` (visible in graph, not written to page body)
- A dedicated `promote` pass validates source grounding + consistency
- Only edges that pass get materialized as `[[wikilinks]]` in the page
- **Link density budget**: a page must have ≥2 outbound wikilinks before promotion

### Hard Rules
| ID | Rule | Rationale |
|---|---|---|
| HG-WA-01 | Graph layer MUST NOT auto-create pages from broken links — report only | LLM ingest produces hallucinated wikilinks; auto-creating amplifies noise |
| HG-WA-02 | New slash commands MUST NOT duplicate existing command coverage | Prevents user confusion; merge into existing commands instead |
