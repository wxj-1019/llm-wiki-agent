interface SourceCardProps {
  path: string;
  preview: string;
  onClick: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  source: '📄',
  entity: '👤',
  concept: '💡',
  synthesis: '📦',
};

export function SourceCard({ path, preview, onClick }: SourceCardProps) {
  const slug = path.replace(/^wiki\//, '').replace(/\.md$/, '');
  const parts = slug.split('/');
  const pageType = parts[0] || 'source';
  const pageName = parts[parts.length - 1] || slug;
  const icon = TYPE_ICONS[pageType] || '📄';

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[var(--text-primary)] truncate group-hover:text-blue-500 transition-colors">
            {pageName}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
            {preview}
          </div>
        </div>
      </div>
    </button>
  );
}
