import type { GraphNode } from '@/types/graph';

const prefixMap: Record<string, string> = {
  source: 's',
  entity: 'e',
  concept: 'c',
  synthesis: 'y',
};

export function resolveWikiLink(target: string, nodes: GraphNode[]): string {
  const node = nodes.find(
    (n) => n.label.toLowerCase() === target.toLowerCase() || n.id.endsWith(`/${target}`)
  );
  if (!node) return `/search?q=${encodeURIComponent(target)}`;

  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || target;
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
