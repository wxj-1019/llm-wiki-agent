import { useTranslation } from 'react-i18next';
import { ExternalLink, Quote } from 'lucide-react';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { WikiChatSource } from '@/services/chatService';
import { useState } from 'react';

interface ChatDocPreviewProps {
  sources: WikiChatSource[];
  activePath: string | null;
  onSelectPath: (path: string) => void;
  onQuote: (text: string) => void;
}

export function ChatDocPreview({ sources, activePath, onSelectPath, onQuote }: ChatDocPreviewProps) {
  const { t } = useTranslation();
  const [docContent, setDocContent] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  const activeSource = sources.find((s) => s.path === activePath);

  // In a full implementation, this would fetch from /api/wiki/read
  // For now, show the preview from the source data
  const previewContent = activeSource?.preview || '';

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('chat.right.noDoc', 'No linked documents')}
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {t('chat.right.noDocDesc', 'Send a message to see related wiki pages here')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Source list */}
      <div className="p-2 border-b border-[var(--border-default)]">
        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1 px-1">
          {t('chat.right.sources', 'Sources')} ({sources.length})
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {sources.map((src) => {
            const slug = src.path.replace(/^wiki\//, '').replace(/\.md$/, '');
            const isActive = src.path === activePath;
            return (
              <button
                key={src.path}
                onClick={() => onSelectPath(src.path)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="font-medium truncate">{src.preview?.slice(0, 60) || slug}</div>
                <div className="text-[10px] text-[var(--text-tertiary)] truncate">{slug}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeSource && (
          <>
            <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-[20]">
              {previewContent || (
                <span className="text-[var(--text-tertiary)] italic">
                  {t('chat.right.loadingDoc', 'Loading document...')}
                </span>
              )}
            </div>

            {/* Actions */}
            {previewContent && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border-default)]">
                <button
                  onClick={() => onQuote(previewContent.slice(0, 500))}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
                >
                  <Quote className="w-3 h-3" />
                  {t('chat.right.quoteToChat', 'Quote')}
                </button>
                <a
                  href={`/${activeSource.path.replace(/\.md$/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('chat.right.openInNewTab', 'Open')}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
