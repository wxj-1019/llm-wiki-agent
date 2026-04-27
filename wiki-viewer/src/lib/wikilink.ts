import type { GraphNode } from '@/types/graph';

export function resolveWikiLink(target: string, nodes: GraphNode[]): string {
  const node = nodes.find(
    (n) => n.label === target || n.id.endsWith(`/${target}`)
  );
  if (!node) return `/search?q=${encodeURIComponent(target)}`;

  const prefixMap: Record<string, string> = {
    source: 's',
    entity: 'e',
    concept: 'c',
    synthesis: 'y',
  };
  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || target;
  return `/${prefix}/${slug}`;
}

export function extractWikiLinks(markdown: string): string[] {
  const matches = markdown.matchAll(/\[\[([^\]]+)\]\]/g);
  return Array.from(new Set(Array.from(matches).map((m) => m[1])));
}
