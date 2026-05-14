---
title: "TanStackQuery"
type: entity
tags: [library, react, data-fetching]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

[[TanStackQuery]] (formerly React Query) is a data-fetching and caching library for React. In the [[APIServer|LLM Wiki Viewer]] frontend, it wraps all API calls via `useQuery` hooks (e.g., `useGraphData`, `useRawFiles`, `useFtsSearch`) with `staleTime` and `enabled` configuration.