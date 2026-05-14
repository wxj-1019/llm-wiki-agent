---
title: "TwoTierGraphFetch"
type: concept
tags: [pattern, fallback, resilience]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

Two-tier graph fetch is a fetch strategy where the primary source (API server at `/api/graph`) is attempted first; if unavailable, a static fallback (`${BASE_URL}data/graph.json`) is used. This allows the production build to work without a running API server, using a pre-built graph data file. Both requests have a 10-second timeout. Used in `fetchGraphData()` in [[data-service-dataservicets|dataService.ts]].