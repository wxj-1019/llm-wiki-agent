---
title: "GraphExportFormats"
type: concept
tags: [graph, export, visualization]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# GraphExportFormats

**GraphExportFormats** defines the set of export formats supported by the [[GraphPage]] component for knowledge graph data:

- **PNG**: Raster image export via `canvas.toDataURL()`.
- **SVG**: Vector image export via [[VisJS]] `getSVG` method.
- **CSV**: Comma-separated values for node list and edge list separately.
- **GraphML**: XML-based graph exchange format for interoperability with network analysis tools.
- **GEXF**: Extended graph XML format used by Gephi and other analysis platforms.

## Connections
- [[GraphPage]] — implements these export formats
- [[VisJS]] — underlying graph rendering library
- [[graph.json]] — source data for exports