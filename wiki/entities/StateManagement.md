---
title: "StateManagement"
type: entity
tags: [architecture, pipeline, deduplication, quality-scoring]
sources: [overview.md, AutoIngestModule.md, auto-ingest-pipeline-auto-ingest-py.md]
---

# StateManagement

StateManagement refers to the internal coordination system within the wiki's ingest pipeline that governs the lifecycle and quality of source material during automated processing. In the context of this wiki, it is primarily implemented by the `auto_ingest` module, which orchestrates the conversion of raw fetched `.md` files into structured wiki source pages. The system maintains state through quality scoring (on a 0–100 scale) to filter out noise and navigation artifacts, entity and concept detection for stub page creation, and near-duplicate content fingerprinting to prevent redundant entries. StateManagement also encompasses the decision logic for triggering post-ingest knowledge graph rebuilds, ensuring that the wiki's structural state remains coherent after each ingest cycle. Its significance lies in enabling a zero-LLM fast-path automation pipeline that operates deterministically, reducing operational overhead while maintaining data integrity across the wiki's expanding knowledge base. Entities such as `quality_scoring`, `entity_detection`, and `deduplication` are directly associated with this system, as they form the core actions performed during state transitions.