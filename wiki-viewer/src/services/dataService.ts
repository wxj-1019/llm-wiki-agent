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
    const res = await fetch(`${import.meta.env.BASE_URL}data/graph.json`);
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
