---
title: "Data Service (dataService.ts) — Unified API Client for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, api, react-query]
date: 2026-05-14
source_file: dataService.ts
---

## Summary
The `dataService.ts` module is the primary frontend API client for the [[APIServer|LLM Wiki Viewer]]. It provides a comprehensive set of functions for fetching wiki content (pages, graph, log, search), managing raw files (list, upload, delete), triggering ingestion, managing web crawlers, and monitoring pipeline health. Built on [[TanStackQuery]] for declarative data fetching and caching, with built-in request deduplication via an in-flight promise cache.

## Key Claims
- **Request deduplication**: The `dedupe()` function caches in-flight `Promise<T>` objects per endpoint key so concurrent calls share one request. Applied to `fetchGraphData`, `fetchRawFiles`, `fetchRawFileContent`, `fetchLog`, and all `use*` hooks.
- **Safe JSON parsing**: `safeJson<T>()` checks for empty body before parsing, avoiding cryptic "Unexpected end of JSON input" errors when the backend is down.
- **Two-tier graph fetch**: `fetchGraphData()` tries `GET /api/graph` (API server) first, falling back to `${BASE_URL}data/graph.json` (static build). Both with 10s timeout.
- **Full file management**: `fetchRawFiles()`, `uploadFile()` (multipart), `uploadText()` (JSON body), `deleteRawFile()`, `fetchRawFileContent()` — all validate file paths via `isValidFilePath()`.
- **Ingestion pipeline**: `triggerIngest()` POSTs to `/api/ingest` (120s timeout), `fetchIngestJobs()`/`fetchIngestJob()` query job status, including Ollama embedding jobs.
- **Llama-powered CLI ingest**: `ingestImageFile()` POSTs image files to `/api/ingest/image` with a question for vision model processing.
- **Web clipping**: `clipUrl()` POSTs to `/api/webhook/clip` (120s) to fetch and save a URL article.
- **All crawler triggers**: `runCrawler()`, `runRssCrawler()`, `runGithubCrawler()`, `runArxivCrawler()`, `runBatchPipeline()` — each triggers the corresponding `POST /api/crawler/*` endpoint with optional config overrides.
- **Log fetching**: `fetchLog()` retrieves raw markdown log and parses entries via regex `## [YYYY-MM-DD] operation | title`.
- **Search**: `searchFts()` supports FTS5 full-text (5s timeout) and optional semantic (30s timeout) with `semantic` parameter. `searchUnified()` combines wiki and web search into single UI-friendly results with `type` field.
- **React Query hooks**: `useGraphData`, `useRawFiles`, `useLog`, `useFtsSearch`, `useWebSourcesConfig`, `useIndexEtag`, `useRawFileContent` — all use `useQuery` with appropriate `staleTime` and `enabled` guards.
- **Efficient polling for large fetches**: `fetchGraphData()` checks `GET /api/graph/etag` via `fetchIndexEtag()` to poll for graph rebuild completion (retry until etag changes).
- **Graph tools**: `exportGraph()` triggers graph export to an MCP server path, `queryGraph()` performs graph queries (both POST).
- **Pipeline health**: `fetchPipelineHealth()` returns pipeline status with per-step status and last-run timestamps.
- **Webhook ingestion**: `webhookIngest()` POSTs to `/api/webhook/ingest` (120s) with file path.
- **Tools listing**: `fetchToolsList()` returns available tools with name, description, endpoint, and method.
- **Reindexing**: `reindexFts()` reindexes FTS with optional Ollama embeddings, `reindexEmbeddings()` reindexes semantic embeddings only.

## Key Quotes
> "GET requests are deduplicated: multiple concurrent calls to the same endpoint share a single in-flight promise to avoid redundant network traffic."

> "Safe JSON parse — checks for empty body first to avoid the cryptic 'Unexpected end of JSON input' error when the backend is down or returns an empty response."

## Connections
- [[APIServer]] — the backend this service communicates with
- [[SafeJson]] — helper function for robust JSON parsing
- [[Dedupe]] — in-flight request cache pattern
- [[TanStackQuery]] — React Query for declarative data fetching
- [[IngestJob]] — job tracking interface
- [[ToolInfo]] — tool descriptor interface
- [[RawFile]] — raw file metadata interface
- [[UploadResult]] — upload response interface
- [[FtsResult]] — search result interface
- [[LogEntry]] — log entry interface
- [[IngestJobStatus]] — job status enum

## Contradictions
- None identified.
