---
title: "Auto-Ingest Pipeline — auto_ingest.py"
type: source
tags: [automation, pipeline, ingest, quality-scoring, entity-detection, dedup]
date: 2026-05-14
source_file: tools/auto_ingest.py
---

## Summary

The `auto_ingest.py` script is the **fast path** for the automation pipeline: it directly converts fetched `.md` files from `raw-inbox/fetched/<source>/` into structured wiki source pages, bypassing the batch pipeline entirely. It includes quality scoring (0-100) to filter out navigation/noise content, entity and concept detection for auto-creating stub pages, near-duplicate content fingerprinting, automatic `[[wikilink]]` generation, and optional knowledge graph rebuild triggering.

## Key Claims

- **No LLM calls**: Unlike the legacy batch pipeline, `auto_ingest.py` does not require any LLM API calls — all processing is deterministic (regex-based quality scoring, fuzzy matching for entity detection, MD5 content fingerprints for near-duplicate detection).
- **Quality scoring with configurable threshold**: Uses `_score_quality()` to assign a 0-100 quality score, penalizing noise patterns (login forms, navigation links, copyright boilerplate, financial calculator widgets) and rewarding content signals (headings, bold text, markdown links, bullet lists, Chinese prose with punctuation). Default threshold is 30 (configurable via `--min-quality`).
- **Entity/concept auto-detection**: `_detect_entities()` uses subtitle-matched fuzzy detection across the entire wiki index to find mentions of existing entities and concepts, plus keyword-based detection of known types (people, companies, products, technologies, AI models, frameworks). Auto-creates stub entity pages for strong matches.
- **Near-duplicate filtering**: `_content_fingerprint()` generates an MD5 hash of whitespace-normalized body text. If a content hash has been seen before (tracked in `state.json`), the file is skipped as a duplicate — identical to original within 95% similarity.
- **Aggressive wikilink generation**: The `_generate_summary()` function (placeholder currently) and `_build_source_page()` convert known entity/concept names into `[[wikilinks]]` inline in the generated page body, creating dense internal connections.
- **Atomic file writes**: `_atomic_write()` writes to a temp file then atomically renames, preventing partial writes from crashes.
- **Post-ingest graph rebuild**: After successful ingest, calls `build_graph.py rebuild-hot PYTHON` to asynchronously trigger a graph rebuild (non-blocking via subprocess + threading).

## Key Quotes

> "Auto-ingest fetched .md files directly into wiki/sources/ structured markdown."

> "Bypasses the batch pipeline for fast automated ingestion."

> "Quality threshold (0-100), default 30 — skip low-quality noise pages."

## Connections

- [[BatchIngest]] — the legacy path that `auto_ingest.py` bypasses
- [[BatchCompiler]] — the batch compilation step bypassed by the fast path
- [[BuildGraphTool]] — triggered after ingest to rebuild the knowledge graph
- [[IngestTool]] — the LLM-powered ingest script used by the legacy batch path
- [[Fetchers]] — the pipeline scripts that produce the `.md` files in `raw-inbox/fetched/`
- [[QualityScoring]] — the heuristic quality assessment algorithm
- [[ContentFingerprinting]] — the near-duplicate detection mechanism
- [[StateManagement]] — `state.json` persistence for pipeline state
- [[BidirectionalConfigSync]] — related pattern for config persistence

## Contradictions

- None.
