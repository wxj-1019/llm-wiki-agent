---
title: "DataService"
type: code_module
tags: [typescript, api, data-fetching]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

# `dataService.ts` — Unified API Client

## Overview
This module provides the complete frontend API surface for the [[APIServer|LLM Wiki Viewer]], wrapping all backend endpoints with request deduplication, safe JSON parsing, and [[TanStackQuery]] hooks.

## Key Functions
- **`safeJson<T>(res: Response): Promise<T>`** — Parses JSON after empty-body check
- **`dedupe<T>(key: string, factory: () => Promise<T>): Promise<T>`** — In-flight request cache
- **`fetchGraphData(): Promise<GraphData>`** — Two-tier graph data fetch
- **`fetchRawFiles(): Promise<RawFile[]>`** — List raw/ directory
- **`uploadFile(file: File): Promise<UploadResult>`** — Multipart upload
- **`uploadText(title: string, content: string): Promise<UploadResult>`** — Text upload
- **`triggerIngest(path: string): Promise<IngestResult>`** — Trigger ingestion
- **`fetchRawFileContent(path: string): Promise<string>`** — Read raw file content
- **`deleteRawFile(path: string): Promise<{success: boolean}>`** — Delete raw file
- **`searchFts(query: string, limit?: number, semantic?: boolean): Promise<FtsResult[]>`** — FTS + semantic search
- **`fetchLog(tail?: number): Promise<{entries: LogEntry[]; markdown: string}>`** — Wiki log
- **`parseLogEntries(text: string): LogEntry[]`** — Regex-based log parser
- **`reindexEmbeddings(): Promise<{success: boolean; message: string}>`** — Reindex Ollama embeddings
- **`fetchIndexEtag(): Promise<{etag: string}>`** — Poll graph rebuild completion
- **`ingestImageFile(file: File, question?: string): Promise<IngestJob>`** — Vision ingest
- **`fetchUrlArticle(url: string): Promise<IngestJob>`** — Fetch & save URL
- **`saveWikiPage(title: string, content: string): Promise<{success: boolean}>`** — Direct wiki page save
- **`fetchWebSourcesConfig(): Promise<any>`** — Get web scraper config
- **`saveWebSourcesConfig(config: any): Promise<any>`** — Save web scraper config
- **`runCrawler()` / `runRssCrawler()` / `runGithubCrawler()` / `runArxivCrawler()` / `runBatchPipeline()`** — Crawler triggers
- **`useGraphData()` / `useRawFiles()` / `useLog()` / `useFtsSearch()` / `useWebSourcesConfig()` / `useIndexEtag()` / `useRawFileContent()`** — React Query hooks
- **`searchWeb(q: string): Promise<WebSearchResult[]>`** — Web search stub
- **`searchUnified(q: string): Promise<UnifiedSearchResult[]>`** — Combined web + wiki search
- **`searchReindexFts(useOllama?: boolean): Promise<{success: boolean; message: string}>`** — Reindex FTS
- **`exportGraph(path: string, includeInferred?: boolean): Promise<{success: boolean; message: string; graph_path?: string}>`** — Export graph
- **`queryGraph(query: string): Promise<{success: boolean; results?: any[]; message?: string}>`** — Graph queries
- **`fetchPipelineHealth(): Promise<{running: boolean; steps: any[]}>`** — Pipeline health
- **`fetchIngestJobs(): Promise<IngestJob[]>`** — List jobs
- **`fetchIngestJob(jobId: string): Promise<IngestJob>`** — Single job status
- **`fetchToolsList(): Promise<{tools: ToolInfo[]}>`** — Available frontend tools
- **`clipUrl(url: string, title?: string, tags?: string[]): Promise<...>`** — Web clipping
- **`webhookIngest(path: string): Promise<...>`** — Webhook ingest

## Imports
- `@/types/graph` ([[GraphData]] type)
- `@/lib/fetchWithTimeout`
- `@/lib/validation` ([[isValidFilePath]])
- `@tanstack/react-query` ([[useQuery]])