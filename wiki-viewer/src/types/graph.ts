export interface GraphNode {
  id: string;
  label: string;
  type: 'source' | 'entity' | 'concept' | 'synthesis' | 'unknown';
  color: string;
  path: string;
  markdown: string;
  preview: string;
  group: number;
  value: number;
  tags?: string[];
  last_updated?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';
  title: string;
  label: string;
  color: string;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  built: string;
}

export interface PageMeta {
  title: string;
  type: 'source' | 'entity' | 'concept' | 'synthesis';
  tags: string[];
  sources: string[];
  last_updated?: string;
  date?: string;
  [key: string]: unknown;
}
