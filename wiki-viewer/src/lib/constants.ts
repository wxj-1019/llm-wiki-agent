/** Shared route prefix mapping for wiki page types. */
export const PAGE_PREFIX_MAP: Record<string, string> = {
  source: 's',
  entity: 'e',
  concept: 'c',
  synthesis: 'y',
};

/** Reverse mapping from route prefix to type name. */
export const PREFIX_TO_TYPE: Record<string, string> = {
  s: 'source',
  e: 'entity',
  c: 'concept',
  y: 'synthesis',
};

/** Human-readable breadcrumb label keys for page types. */
export const TYPE_LABEL_KEY = (type: string): string => {
  const map: Record<string, string> = {
    source: 'type.source',
    entity: 'type.entity',
    concept: 'type.concept',
    synthesis: 'type.synthesis',
  };
  return map[type] || type;
};
