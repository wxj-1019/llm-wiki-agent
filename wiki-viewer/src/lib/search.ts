import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';

let fuse: Fuse<GraphNode> | null = null;
let allNodes: GraphNode[] = [];

export function initSearch(nodes: GraphNode[]) {
  allNodes = nodes;
  fuse = new Fuse(nodes, {
    keys: [
      { name: 'label', weight: 0.5 },
      { name: 'preview', weight: 0.3 },
      { name: 'markdown', weight: 0.2 },
    ],
    threshold: 0.3,
    includeMatches: true,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

export function searchNodes(query: string): FuseResult<GraphNode>[] {
  if (!fuse || !query) return [];
  return fuse.search(query);
}

/**
 * Full-text search that strips YAML frontmatter before indexing.
 * This reduces noise from metadata and improves content relevance.
 */
export function searchContent(query: string): FuseResult<GraphNode>[] {
  if (!query || allNodes.length === 0) return [];

  const contentFuse = new Fuse(allNodes, {
    keys: [
      { name: 'label', weight: 0.4 },
      { name: 'preview', weight: 0.35 },
      {
        name: 'markdown',
        weight: 0.25,
        getFn: (node: GraphNode) => {
          // Strip frontmatter for cleaner content search
          const m = node.markdown;
          if (m.startsWith('---')) {
            const end = m.indexOf('---', 3);
            if (end !== -1) return m.slice(end + 3).trim();
          }
          return m;
        },
      },
    ],
    threshold: 0.35,
    includeMatches: true,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });

  return contentFuse.search(query);
}
