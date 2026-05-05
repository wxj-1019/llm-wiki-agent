/**
 * Strip markdown syntax to produce clean plain text for previews.
 * Handles headings, bold/italic, links, wikilinks, code, lists, blockquotes.
 */
export function stripMarkdown(md: string): string {
  if (!md) return '';
  return (
    md
      // Remove wikilinks: [[Page Name]] → Page Name
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Remove markdown links: [text](url) → text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove reference links: [text][id] → text
      .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // Remove headings: # Heading → Heading
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic/strikethrough markers
      .replace(/(\*{1,2}|_{1,2}|~{2})(.*?)\1/g, '$2')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove blockquote markers
      .replace(/^>\s*/gm, '')
      // Remove list bullets/numbers
      .replace(/^(\s*[-*+]\s+|\d+\.\s+)/gm, '')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}
