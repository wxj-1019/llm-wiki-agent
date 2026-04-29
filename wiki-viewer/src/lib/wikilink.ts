import type { GraphNode } from '@/types/graph';

const prefixMap: Record<string, string> = {
  source: 's',
  entity: 'e',
  concept: 'c',
  synthesis: 'y',
};

/**
 * Resolve a [[wikilink]] target (label or slug) to a router path.
 * Returns path + whether the target page exists.
 */
export function resolveWikiLink(
  target: string,
  nodes: GraphNode[]
): { path: string; exists: boolean } {
  const node = nodes.find(
    (n) => n.label.toLowerCase() === target.toLowerCase() || n.id.endsWith(`/${target}`)
  );
  if (!node) return { path: `/search?q=${encodeURIComponent(target)}`, exists: false };

  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || target;
  return { path: `/${prefix}/${slug}`, exists: true };
}

/**
 * Convert a node { id, type } to its page path.
 * Centralized to avoid duplicating prefixMap across components.
 */
export function getPagePath(node: { id: string; type: string }): string {
  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || node.id;
  return `/${prefix}/${slug}`;
}

export function extractWikiLinks(markdown: string): string[] {
  const matches = markdown.matchAll(/\[\[([^\]]+)\]\]/g);
  return Array.from(new Set(Array.from(matches).map((m) => {
    // Handle piped links: [[Target|Display]] → extract Target
    const target = m[1];
    const pipeIdx = target.indexOf('|');
    return pipeIdx >= 0 ? target.substring(0, pipeIdx) : target;
  })));
}
