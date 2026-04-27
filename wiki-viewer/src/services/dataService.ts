import type { GraphData } from '@/types/graph';

const DATA_BASE = import.meta.env.BASE_URL;

export async function fetchGraphData(): Promise<GraphData> {
  const res = await fetch(`${DATA_BASE}data/graph.json`);
  if (!res.ok) throw new Error(`Failed to load graph: ${res.status}`);
  return res.json();
}

export async function fetchMarkdown(relativePath: string): Promise<string> {
  const res = await fetch(`${DATA_BASE}${relativePath}`);
  if (!res.ok) throw new Error(`Failed to load: ${relativePath}`);
  return res.text();
}
