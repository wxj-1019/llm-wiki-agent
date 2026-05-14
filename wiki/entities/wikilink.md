---
title: "wikilink"
type: entity
tags: [syntax, linking, knowledge-graph, wiki-structure, automation]
sources: [auto-ingest-pipeline-auto-ingest-py.md]
---

# wikilink

A **wikilink** is the standard wiki markup syntax (`[[wikilink]]`) used throughout the Personal LLM Wiki to create internal hyperlinks between pages, thereby forming the backbone of the knowledge graph. In this context, wikilinks are not merely navigational aids but serve as explicit semantic connections that the system uses for entity detection, automatic stub page creation, and knowledge graph rebuilds. The `auto_ingest.py` pipeline automatically generates wikilinks when processing ingested content, scanning for entity and concept mentions to link them to their definitive source pages. This automated linking ensures that the wiki remains densely interconnected without requiring manual annotation, and the presence of wikilinks directly influences the auto-creation of stub pages for newly detected entities. As such, wikilinks function as both a human-readable navigation mechanism and a machine-parseable data structure that drives the wiki's self-organizing properties.