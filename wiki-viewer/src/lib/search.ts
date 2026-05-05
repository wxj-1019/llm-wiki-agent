import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';
import { searchFts } from '@/services/dataService';

let fuse: Fuse<GraphNode> | null = null;
let contentFuse: Fuse<GraphNode> | null = null;
let contentFuseNodes: GraphNode[] = [];
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
  contentFuse = null; // Reset content fuse when nodes change
  contentFuseNodes = [];
}

export function getAllNodes(): GraphNode[] {
  return allNodes;
}

export function searchNodes(query: string): FuseResult<GraphNode>[] {
  if (!fuse || !query) return [];
  return fuse.search(query);
}

function stripFrontmatter(markdown: string): string {
  // Robust frontmatter stripping: match only at start of file
  const match = markdown.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  if (match) return markdown.slice(match[0].length).trim();
  return markdown;
}

/**
 * Full-text search that strips YAML frontmatter before indexing.
 * This reduces noise from metadata and improves content relevance.
 */
export function searchContent(query: string): FuseResult<GraphNode>[] {
  if (!query || allNodes.length === 0) return [];

  if (!contentFuse) {
    contentFuse = new Fuse(allNodes, {
      keys: [
        { name: 'label', weight: 0.4 },
        { name: 'preview', weight: 0.35 },
        {
          name: 'markdown',
          weight: 0.25,
          getFn: (node: GraphNode) => stripFrontmatter(node.markdown),
        },
      ],
      threshold: 0.35,
      includeMatches: true,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });
  }

  return contentFuse.search(query);
}

/**
 * Hybrid search: FTS5 backend + Fuse.js fallback.
 * First queries the SQLite FTS5 endpoint for fast, ranked full-text search.
 * If the endpoint is unavailable or returns few results, falls back to
 * client-side Fuse.js search for the remainder.
 */
export async function hybridSearch(
  query: string,
  nodes: GraphNode[],
  semantic = false,
): Promise<FuseResult<GraphNode>[]> {
  if (!query || nodes.length === 0) return [];

  // 1. Try FTS5 backend first (with optional semantic boost)
  let ftsMatches: FuseResult<GraphNode>[] = [];
  try {
    const apiResults = await searchFts(query, 20, semantic);
    const nodeMap = new Map(nodes.map((n, i) => [n.path, { node: n, index: i }]));
    for (const r of apiResults) {
      const mapped = nodeMap.get(r.path);
      if (mapped) {
        ftsMatches.push({
          item: mapped.node,
          refIndex: mapped.index,
          score: Math.max(0, r.rank / 100), // BM25 rank → Fuse-like score (small = good)
          matches: [],
        } as FuseResult<GraphNode>);
      }
    }
  } catch {
    // API down or CORS issue — fall through to Fuse.js
  }

  // 2. If FTS returned < 5 results, supplement with Fuse.js
  if (ftsMatches.length < 5) {
    // Rebuild contentFuse if nodes have changed since last creation
    if (!contentFuse || contentFuseNodes.length !== nodes.length || contentFuseNodes[0]?.path !== nodes[0]?.path) {
      contentFuse = new Fuse(nodes, {
        keys: [
          { name: 'label', weight: 0.4 },
          { name: 'preview', weight: 0.35 },
          {
            name: 'markdown',
            weight: 0.25,
            getFn: (node: GraphNode) => stripFrontmatter(node.markdown),
          },
        ],
        threshold: 0.35,
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 3,
      });
      contentFuseNodes = nodes;
    }
    const fuseResults = contentFuse.search(query);
    const seen = new Set(ftsMatches.map((m) => m.item.path));
    for (const fr of fuseResults) {
      if (!seen.has(fr.item.path)) {
        ftsMatches.push(fr);
        if (ftsMatches.length >= 20) break;
      }
    }
  }

  // Sort by score (ascending — lower is better)
  ftsMatches.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
  return ftsMatches;
}
