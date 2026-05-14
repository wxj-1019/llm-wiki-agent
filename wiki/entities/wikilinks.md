---
title: "wikilinks"
type: entity
tags: [wiki, markdown, linking, graph]
sources: [HealthChecker.md, auto-ingest-pipeline-auto-ingest-py.md, build-graph-tool-knowledge-graph-builder.md, ingest-tool-source-document-processing-engine.md]
---

# wikilinks

In the context of this wiki, `wikilinks` refer to the `[[double-bracket markdown syntax]]` used to create internal hyperlinks between wiki pages. They serve as the primary mechanism for establishing explicit, human-authored connections between entities, concepts, and modules within the knowledge base. Unlike standard Markdown hyperlinks, `wikilinks` are natively understood by the wiki toolchain: the auto-ingest pipeline automatically generates `[[wikilink]]` references when converting fetched documents, the ingest tool preserves and indexes them during source document processing, and the build graph tool parses all explicit `wikilinks` as `EXTRACTED` edges for the knowledge graph, forming the backbone of the structural relationship map. The HealthChecker includes a dedicated function for detecting broken `wikilinks` to maintain link integrity. While the graph builder can also infer implicit relationships via LLM, `wikilinks` remain the ground truth for explicitly stated connections in the wiki, and their health (no dangling references, proper target pages existing) is a key quality metric tracked by the system.