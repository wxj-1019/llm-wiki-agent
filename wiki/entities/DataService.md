---
title: "DataService"
type: entity
tags: [frontend, api, service]
sources: [data-service-dataservicets, wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

`dataService.ts` provides the unified frontend API client for the LLM Wiki Viewer. Used by [[WikiStore]] to fetch graph data (`fetchGraphData`) and check index changes via ETag (`fetchIndexEtag`).