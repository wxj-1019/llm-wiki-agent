import type { GraphData } from '@/types/graph';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { isValidFilePath } from '@/lib/validation';

/**
 * Fetch wiki data from the API server (tools/api_server.py).
 * In development, vite.config.ts proxies /api/* to localhost:8000.
 * In production (static build), graph data is embedded in public/data/graph.json.
 *
 * GET requests are deduplicated: multiple concurrent calls to the same endpoint
 * share a single in-flight promise to avoid redundant network traffic.
 */

const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = factory().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export async function fetchGraphData(): Promise<GraphData> {
  return dedupe('graph', async () => {
    // Try API server first
    try {
      const res = await fetchWithTimeout('/api/graph', { timeoutMs: 10000 });
      if (res.ok) return res.json();
    } catch {
      // API server not available, fall through to static file
    }

    // Fallback: static graph.json for production build without API server
    const res = await fetchWithTimeout(`${import.meta.env.BASE_URL}data/graph.json`, { timeoutMs: 10000 });
    if (!res.ok) throw new Error(`Failed to load graph data: ${res.status}`);
    return res.json();
  });
}

export interface RawFile {
  path: string;
  name: string;
  size: number;
  modified: number;
  ingested?: boolean;
}

export interface UploadResult {
  success: boolean;
  path: string;
  converted_path?: string | null;
  size?: number;
}

export interface IngestResult {
  success: boolean;
  stdout: string;
  stderr: string;
  returncode: number;
}

export async function fetchRawFiles(): Promise<RawFile[]> {
  return dedupe('raw-files', async () => {
    const res = await fetchWithTimeout('/api/raw-files', { timeoutMs: 10000 });
    if (!res.ok) throw new Error(`Failed to fetch raw files: ${res.status}`);
    const data = await res.json();
    return data.files || [];
  });
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchWithTimeout('/api/upload/file', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadText(title: string, content: string): Promise<UploadResult> {
  const res = await fetchWithTimeout('/api/upload/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function triggerIngest(path: string): Promise<IngestResult> {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  const res = await fetchWithTimeout('/api/ingest', { timeoutMs: 120000,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Ingest failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchRawFileContent(path: string): Promise<string> {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  return dedupe(`raw-file:${path}`, async () => {
    const res = await fetchWithTimeout(`/api/raw-file-content?path=${encodeURIComponent(path)}`, { timeoutMs: 10000 });
    if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
    const data = await res.json();
    return data.content || '';
  });
}

export async function deleteRawFile(path: string): Promise<{ success: boolean }> {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  const res = await fetchWithTimeout(`/api/raw-files/${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Delete failed: ${res.status}`);
  }
  return res.json();
}

export interface FtsResult {
  path: string;
  title: string;
  type: string;
  rank: number;
  excerpt: string;
}

export async function searchFts(query: string, limit = 20, semantic = false): Promise<FtsResult[]> {
  const url = `/api/search/fts?q=${encodeURIComponent(query)}&limit=${limit}&semantic=${semantic}`;
  const res = await fetchWithTimeout(url, { timeoutMs: semantic ? 30000 : 5000 });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

export interface LogEntry {
  date: string;
  operation: string;
  title: string;
}

export async function fetchLog(tail = 0): Promise<{ entries: LogEntry[]; markdown: string }> {
  const url = tail > 0 ? `/api/log?tail=${tail}` : '/api/log';
  const res = await fetchWithTimeout(url, { timeoutMs: 10000 });
  if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
  const data = await res.json();
  return { markdown: data.markdown || '', entries: parseLogEntries(data.markdown || '') };
}

function parseLogEntries(text: string): LogEntry[] {
  const lines = text.split('\n');
  const entries: LogEntry[] = [];
  const re = /^## \[(\d{4}-\d{2}-\d{2})\]\s+(\w+)\s*\|\s*(.+)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      entries.push({ date: m[1], operation: m[2].toLowerCase(), title: m[3].trim() });
    }
  }
  return entries.reverse();
}

export async function reindexEmbeddings(): Promise<{ success: boolean; message: string }> {
  const res = await fetchWithTimeout('/api/search/reindex-embeddings', {
    method: 'POST',
    timeoutMs: 300000,
  });
  if (!res.ok) throw new Error(`Reindex failed: ${res.status}`);
  return res.json();
}

export async function fetchIndexEtag(): Promise<string> {
  try {
    const res = await fetchWithTimeout('/api/index-etag', { timeoutMs: 5000 });
    if (!res.ok) return '0';
    return res.text();
  } catch {
    return '0';
  }
}

export async function ingestImageFile(file: File): Promise<{ success: boolean; description: string; md_path: string; stdout: string; stderr: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchWithTimeout('/api/multimodal/ingest', {
    method: 'POST',
    body: formData,
    timeoutMs: 300000,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Image ingest failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchUrlArticle(url: string, name = '', tags: string[] = []): Promise<{ success: boolean; saved_file: string | null; quality: string | null; stdout: string; stderr: string }> {
  const res = await fetchWithTimeout('/api/fetch/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, name, tags }),
    timeoutMs: 120000,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `URL fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function saveWikiPage(path: string, content: string): Promise<{ success: boolean; path: string }> {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  const res = await fetchWithTimeout('/api/wiki/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
    timeoutMs: 10000,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Save failed: ${res.status} ${err}`);
  }
  return res.json();
}

export async function fetchWebSourcesConfig(): Promise<{ name: string; content: string }> {
  return dedupe('config:web_sources', async () => {
    const res = await fetchWithTimeout('/api/config/web_sources', { timeoutMs: 5000 });
    if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
    return res.json();
  });
}

export async function saveWebSourcesConfig(yamlContent: string): Promise<{ success: boolean }> {
  const res = await fetchWithTimeout('/api/config/web_sources', {
    method: 'POST',
    headers: { 'Content-Type': 'text/yaml' },
    body: yamlContent,
    timeoutMs: 5000,
  });
  if (!res.ok) throw new Error(`Failed to save config: ${res.status}`);
  return res.json();
}

export interface CrawlerRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  returncode: number;
  stats: { saved: number; skipped: number; errors: number };
}

export async function runCrawler(): Promise<CrawlerRunResult> {
  const res = await fetchWithTimeout('/api/crawler/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    timeoutMs: 300000,
  });
  if (!res.ok) throw new Error(`Crawler failed: ${res.status}`);
  return res.json();
}

export interface BatchResult {
  success: boolean;
  steps: { name: string; success: boolean; stdout: string; stderr: string; returncode: number }[];
  stopped_at?: string;
}

export async function runBatchPipeline(): Promise<BatchResult> {
  const res = await fetchWithTimeout('/api/crawler/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    timeoutMs: 600000,
  });
  if (!res.ok) throw new Error(`Batch pipeline failed: ${res.status}`);
  return res.json();
}
