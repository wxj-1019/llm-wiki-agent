import type { GraphData } from '@/types/graph';

/**
 * Fetch wiki data from the API server (tools/api_server.py).
 * In development, vite.config.ts proxies /api/* to localhost:8000.
 * In production (static build), graph data is embedded in public/data/graph.json.
 */

export async function fetchGraphData(): Promise<GraphData> {
  // Try API server first
  try {
    const res = await fetch('/api/graph');
    if (res.ok) return res.json();
  } catch {
    // API server not available, fall through to static file
  }

  // Fallback: static graph.json for production build without API server
  const res = await fetch(`${import.meta.env.BASE_URL}data/graph.json`);
  if (!res.ok) throw new Error(`Failed to load graph data: ${res.status}`);
  return res.json();
}
