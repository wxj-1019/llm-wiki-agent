import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';

let fuse: Fuse<GraphNode> | null = null;

export function initSearch(nodes: GraphNode[]) {
  fuse = new Fuse(nodes, {
    keys: [
      { name: 'label', weight: 0.5 },
      { name: 'preview', weight: 0.3 },
      { name: 'markdown', weight: 0.2 },
    ],
    threshold: 0.3,
    includeMatches: true,
    includeScore: true,
  });
}

export function searchNodes(query: string): FuseResult<GraphNode>[] {
  if (!fuse || !query) return [];
  return fuse.search(query);
}
