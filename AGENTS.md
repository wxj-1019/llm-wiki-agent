<!-- From: e:\A_Project\llm-wiki-agent\AGENTS.md -->
# LLM Wiki Agent — Project Guide for AI Coding Agents

> **What this is:** This file is the primary configuration read by AI coding agents (Codex, OpenCode, Gemini CLI, Claude Code, etc.). It defines workflows, conventions, and project architecture. If you are an AI agent reading this, follow these instructions to maintain the wiki.

---

## Project Overview

**LLM Wiki Agent** is an agent-driven knowledge management system that turns raw documents into a persistent, interlinked markdown wiki. Unlike traditional RAG (which re-derives knowledge every query), this system **compiles knowledge once at ingest time** and keeps it current through structured markdown pages maintained entirely by AI agents.

Users drop source documents into `raw/` and tell the agent to "ingest" them. The agent reads the document, extracts knowledge, auto-creates entity/concept pages, cross-references everything with `[[wikilinks]]`, flags contradictions, and updates a living overview. Over time, the wiki compounds — every new source makes it richer.

**Key principle:** No API key or Python setup is needed when using an agent that reads this file. The agent performs all operations via its own tools. Standalone Python scripts in `tools/` are available for headless/batch usage.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Language** | Python 3.10–3.13 |
| **Package Manager** | Poetry (`pyproject.toml`) |
| **Core Dependencies** | `markitdown[all]` (auto-conversion of 20+ formats), `tqdm` (progress bars) |
| **LLM Gateway** | `litellm` (~1.83.10) — universal API for Claude, OpenAI, Gemini, etc. |
| **Graph Analysis** | `networkx` (~3.6.1) — Louvain community detection |
| **Visualization** | Self-contained HTML with vis.js (CDN-loaded, no server needed) |

**Environment Variables:**
- `LLM_MODEL` — model identifier passed to litellm (default: `claude-3-5-sonnet-latest`)
- Provider-specific API keys as required by litellm (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.)

**Security Note:** `litellm` is pinned to `~=1.83.10` in `requirements.txt` because versions `1.82.7–1.82.8` were compromised in a supply chain attack (March 2026). Never downgrade this dependency.

---

## Directory Layout

```
llm-wiki-agent/
├── raw/                    # Immutable source documents — NEVER modify these
│   └── .gitkeep
├── wiki/                   # Agent-maintained knowledge layer (you own this)
│   ├── index.md            # Catalog of all pages — update on every ingest
│   ├── log.md              # Append-only chronological record
│   ├── overview.md         # Living synthesis across all sources
│   ├── sources/            # One summary page per source document
│   ├── entities/           # People, companies, projects, products
│   ├── concepts/           # Ideas, frameworks, methods, theories
│   └── syntheses/          # Saved query answers
├── graph/                  # Auto-generated graph data
│   ├── graph.json          # Node/edge data (SHA256-cached)
│   ├── graph.html          # Interactive vis.js visualization
│   ├── .cache.json         # Inference cache
│   ├── .inferred_edges.jsonl  # Checkpoint for resume
│   └── .refresh_cache.json    # Refresh operation cache
├── tools/                  # Standalone Python scripts (see Tools Reference below)
├── docs/                   # Documentation
│   └── automated-sync.md   # Cron/launchd automation guide
├── examples/               # Example content
│   └── cjk-showcase/       # Chinese language processing demo
├── .claude/commands/       # Claude Code slash command definitions
├── AGENTS.md               # This file — schema for Codex/OpenCode/generic agents
├── CLAUDE.md               # Schema for Claude Code
├── GEMINI.md               # Schema for Gemini CLI
├── README.md               # Human-facing documentation
├── pyproject.toml          # Poetry-based project config
└── requirements.txt        # Additional pinned dependencies (litellm, networkx)
```

---

## Tools Reference

All scripts in `tools/` are standalone and can be run directly. They require `litellm` and optionally `markitdown`/`networkx`.

| Script | Purpose | LLM Calls? | Usage |
|---|---|---|---|
| `ingest.py` | Ingest source documents into wiki | Yes | `python tools/ingest.py <path>` — auto-converts non-.md files via markitdown; supports batch, `--no-convert`, `--validate-only` |
| `query.py` | Query wiki and synthesize answers | Yes | `python tools/query.py "<question>" [--save [<path>]]` |
| `lint.py` | Content quality checks | Yes (semantic) | `python tools/lint.py [--save]` — orphans, broken links, contradictions, missing entities, data gaps |
| `health.py` | Structural integrity checks | **No** | `python tools/health.py [--save] [--json]` — empty stubs, index sync, log coverage |
| `build_graph.py` | Knowledge graph generation | Yes (inference) | `python tools/build_graph.py [--no-infer] [--open]` — two-pass build with Louvain clustering |
| `heal.py` | Auto-heal missing entity pages | Yes | `python tools/heal.py` — scans for missing entities and generates pages from context |
| `refresh.py` | Refresh stale source pages | Yes (via ingest) | `python tools/refresh.py [--force] [--page sources/X]` — hash-based change detection |
| `pdf2md.py` | PDF/arXiv → Markdown conversion | No | `python tools/pdf2md.py <arxiv-id/url/pdf> [--backend marker\|pymupdf4llm]` |
| `file_to_md.py` | Batch directory conversion | No | `python tools/file_to_md.py --input_dir <dir> [--delete_source]` |
| `api_server.py` | Optional local FastAPI server for wiki viewer | No | `python tools/api_server.py [--host 127.0.0.1] [--port 8000]` |

**Design Boundary (health vs lint):**
- `health.py` = structural integrity, deterministic, **zero LLM calls**, run every session
- `lint.py` = content quality, semantic analysis (uses LLM), run every 10–15 ingests
- Always run `health` first — linting an empty file wastes tokens.

---

## Build and Run Commands

This project has **no build step** and **no formal test suite**. It runs entirely locally with plain markdown files.

**Install dependencies (for standalone script usage):**
```bash
pip install -r requirements.txt
# or, for markitdown conversion support:
pip install markitdown
```

**Poetry users:**
```bash
poetry install
```

**Run workflows:**
```bash
# Ingest a document
python tools/ingest.py raw/papers/my-paper.md

# Query the wiki
python tools/query.py "What are the main themes?"

# Health check (fast, deterministic)
python tools/health.py

# Lint (semantic, uses LLM)
python tools/lint.py

# Build knowledge graph
python tools/build_graph.py --open

# Heal missing entities
python tools/heal.py

# Refresh stale sources
python tools/refresh.py
```

---

## Code Style and Conventions

**Python scripts in `tools/`:**
- Use `#!/usr/bin/env python3` shebang and `from __future__ import annotations`
- Reproducible constants at module top: `REPO_ROOT = Path(__file__).parent.parent`
- Helper functions: `read_file(path: Path) -> str`, `write_file(path: Path, content: str)`
- LLM calls go through `litellm.completion` with `os.getenv("LLM_MODEL", default)`
- Use type hints where practical
- Scripts are self-contained; no shared package structure

**Wiki page format (YAML frontmatter required):**
```yaml
---
title: "Page Title"
type: source | entity | concept | synthesis
tags: []
sources: []       # list of source slugs that inform this page
last_updated: YYYY-MM-DD
---
```

**Naming Conventions:**
- Source slugs / filenames: `kebab-case.md`
- Entity pages: `TitleCase.md` (e.g., `OpenAI.md`, `SamAltman.md`)
- Concept pages: `TitleCase.md` (e.g., `ReinforcementLearning.md`, `RAG.md`)
- Wikilinks: `[[PageName]]`

**Index Format (`wiki/index.md`):**
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

**Log Format (`wiki/log.md`):**
```markdown
## [YYYY-MM-DD] <operation> | <title>
```
Operations: `ingest`, `query`, `health`, `lint`, `graph`, `report`

---

## Testing Strategy

There is **no automated test suite** (no `tests/` directory, no CI/CD). Quality assurance relies on:

1. **`health.py`** — deterministic structural checks (stub files, index sync, log coverage)
2. **`lint.py`** — semantic content quality checks (orphans, broken links, contradictions)
3. **Post-ingest validation** in `ingest.py` — broken wikilink detection, unindexed page detection
4. **Graph health reports** from `build_graph.py --report` — orphan nodes, god nodes, fragile bridges, phantom hubs

When modifying tools, run the relevant workflow manually to verify behavior:
```bash
python tools/health.py
python tools/ingest.py --validate-only
```

---

## Security Considerations

- **`litellm` version pinning:** Keep `litellm~=1.83.10` in `requirements.txt`. Do not upgrade to unverified versions due to the March 2026 supply chain compromise.
- **API keys:** Stored via standard environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.). Never commit keys to the repo.
- **Raw documents:** The `raw/` directory is treated as immutable. Scripts must not modify source files.
- **Optional local server:** `tools/api_server.py` provides an optional FastAPI server for the React wiki viewer (localhost only, CORS-restricted). The core project remains file-based; the server is not required for any workflow.
- **Path traversal protection:** All tools sanitize LLM-generated filenames and user-provided paths against directory traversal (e.g., `../../etc/passwd`). Invalid paths are rejected before any file operation.
- **XSS prevention:** `graph/graph.html` escapes `</script>` sequences when embedding JSON to prevent script injection from wiki content.

---

## Workflows

### Ingest Workflow

Triggered by: *"ingest <file>"*

**Supported formats:** Markdown (`.md`) is ingested directly. Non-markdown files (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.html`, `.txt`, `.csv`, `.json`, `.xml`, `.rst`, `.rtf`, `.epub`, `.ipynb`, `.yaml`, `.yml`, `.tsv`, `.wav`, `.mp3`) are auto-converted to markdown via [markitdown](https://github.com/microsoft/markitdown) before ingestion. Use `--no-convert` to skip auto-conversion.

Steps (in order):
1. Read the source document fully (auto-convert if non-markdown)
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

If the source falls into a specific domain (e.g., personal diary, meeting notes), use a specialized template:

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

### Query Workflow

Triggered by: *"query: <question>"*

Steps:
1. Read `wiki/index.md` to identify relevant pages
2. Read those pages
3. Synthesize an answer with inline citations as `[[PageName]]` wikilinks
4. Ask the user if they want the answer filed as `wiki/syntheses/<slug>.md`

### Lint Workflow

Triggered by: *"lint"*

Check for:
- **Orphan pages** — wiki pages with no inbound `[[links]]` from other pages
- **Broken links** — `[[WikiLinks]]` pointing to pages that don't exist
- **Contradictions** — claims that conflict across pages
- **Stale summaries** — pages not updated after newer sources
- **Missing entity pages** — entities mentioned in 3+ pages but lacking their own page
- **Sparse pages** — pages with fewer than 2 outbound `[[wikilinks]]` (link density budget)
- **Data gaps** — questions the wiki can't answer; suggest new sources

Graph-aware checks (require `graph.json` from `build graph`):
- **Hub stubs** — god nodes (degree > μ+2σ) with thin content (< 500 chars)
- **Fragile bridges** — community pairs connected by only 1 edge
- **Isolated communities** — clusters with zero external connections

Output a lint report and ask if the user wants it saved to `wiki/lint-report.md`.

### Health Workflow

Triggered by: *"health"*

Run: `python tools/health.py` (or `python tools/health.py --json` for machine-readable output)

Fast structural integrity checks — **zero LLM calls**, safe to run every session:
- **Empty / stub files** — pages with no content beyond frontmatter (rate-limit damage)
- **Index sync** — `wiki/index.md` entries vs actual files on disk
- **Log coverage** — source pages missing a corresponding `ingest` entry in `wiki/log.md`

Output a health report. Use `--save` to write to `wiki/health-report.md`.

### Graph Workflow

Triggered by: *"build graph"*

First try: `python tools/build_graph.py --open`

If Python/deps unavailable, build manually:
1. Search for all `[[wikilinks]]` across wiki pages
2. Build nodes (one per page) and edges (one per link)
3. Infer implicit relationships not captured by wikilinks — tag `INFERRED` with confidence score; low confidence → `AMBIGUOUS`
4. Write `graph/graph.json` with `{nodes, edges, built: date}`
5. Write `graph/graph.html` as a self-contained vis.js visualization

### Graph Health Report

Triggered by: *"graph report"* or `python tools/build_graph.py --report`

The `--report` flag generates a structured graph health report covering:
- **Health summary** — edges/node ratio, orphan %, community count, link density
- **Orphan nodes** — pages with zero graph connections
- **God nodes** — hub pages with degree > μ+2σ (disproportionate connectivity)
- **Fragile bridges** — community pairs connected by only 1 edge
- **Phantom hubs** — `[[wikilinks]]` referenced by 2+ existing pages but pointing to non-existent pages (page creation signals)

Use `--save` to write the report to `graph/graph-report.md`.

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
