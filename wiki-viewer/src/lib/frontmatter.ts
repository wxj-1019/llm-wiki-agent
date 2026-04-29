import type { PageMeta } from '@/types/graph';

/**
 * Parse YAML frontmatter from wiki markdown pages.
 * Uses a lightweight hand-rolled parser because wiki frontmatter is flat
 * (no nested objects, only scalars and flat arrays). Adding a full YAML
 * library would be overkill for this constrained schema.
 *
 * Handles:
 *   - Quoted values: title: "hello: world"
 *   - Inline arrays:  tags: [a, b, c]
 *   - Quoted items:   tags: ["a, b", c]
 */
const KV_RE = /^\s*([\w_-]+)\s*:\s*(.+?)\s*$/;
const TRIM_QUOTES_RE = /^["'](.+)["']$/;

function parseArray(raw: string): string[] {
  const inner = raw.slice(1, -1); // remove [ ]
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '"' || ch === "'") {
      depth ^= 1; // toggle quote depth
      current += ch;
    } else if (ch === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items.map((s) => s.replace(TRIM_QUOTES_RE, '$1').trim()).filter(Boolean);
}

export function parseFrontmatter(raw: string): { meta: PageMeta | null; body: string } {
  // Support both \n and \r\n line endings in frontmatter
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: null, body: raw };

  const yamlStr = match[1];
  const body = match[2];

  const meta: Record<string, unknown> = {};
  for (const line of yamlStr.split(/\r?\n/)) {
    const m = line.match(KV_RE);
    if (!m) continue;
    const key = m[1];
    const rawValue = m[2];

    // Quoted scalar: "value" or 'value' — supports commas and colons inside
    const quoteMatch = rawValue.match(TRIM_QUOTES_RE);
    if (quoteMatch) {
      meta[key] = quoteMatch[1];
      continue;
    }

    // Inline array: [a, b, "c, d"]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      meta[key] = parseArray(rawValue);
      continue;
    }

    // Bare scalar
    meta[key] = rawValue;
  }

  return { meta: meta as PageMeta, body };
}
