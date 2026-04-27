import type { PageMeta } from '@/types/graph';

export function parseFrontmatter(raw: string): { meta: PageMeta | null; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: null, body: raw };

  const yamlStr = match[1];
  const body = match[2];

  const meta: Record<string, unknown> = {};
  for (const line of yamlStr.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || !rest.length) continue;
    let value: unknown = rest.join(':').trim();
    if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      value = (value as string)
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/["']/g, ''));
    }
    if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
      value = (value as string).slice(1, -1);
    }
    meta[key.trim()] = value;
  }

  return { meta: meta as PageMeta, body };
}
