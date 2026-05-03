import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { WikiChatSource } from '@/services/chatService';

export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  sources?: WikiChatSource[];
  timestamp?: number;
}

function formatTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ChatMessageProps {
  entry: ChatEntry;
  index: number;
  isLastAssistant: boolean;
  streaming: boolean;
  copiedIndex: number | null;
  onCopy: (content: string, index: number) => void;
  onRegenerate: () => void;
  onSourceClick: (path: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  entry,
  index,
  isLastAssistant,
  streaming,
  copiedIndex,
  onCopy,
  onRegenerate,
  onSourceClick,
}: ChatMessageProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 relative group rounded-2xl ${
          entry.role === 'user'
            ? 'bg-marshmallow-mint/20 border border-marshmallow-mint/30 text-[var(--text-primary)]'
            : 'bg-[var(--bg-secondary)] border border-[var(--border-default)]'
        }`}
      >
        {/* Copy button (assistant only) */}
        {entry.role === 'assistant' && entry.content && (
          <button
            onClick={() => onCopy(entry.content, index)}
            className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
            title={t('chat.copy')}
          >
            {copiedIndex === index ? <Check size={12} className="text-apple-blue" /> : <Copy size={12} />}
          </button>
        )}

        {entry.role === 'user' ? (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
            {entry.timestamp && (
              <p className="text-[10px] mt-1 opacity-60 text-right">{formatTime(entry.timestamp)}</p>
            )}
          </>
        ) : (
          <>
            <div className="prose prose-sm max-w-none">
              {entry.content ? (
                <MarkdownRenderer
                  content={entry.content}
                  enableSourceCitations
                  onSourceClick={onSourceClick}
                />
              ) : entry.sources && entry.sources.length > 0 ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Loader2 size={14} className="animate-spin" />
                  {t('chat.typing')}
                </div>
              ) : streaming && isLastAssistant ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Loader2 size={14} className="animate-spin" />
                  {t('chat.searching')}
                </div>
              ) : null}
            </div>
            {entry.timestamp && (
              <p className="text-[10px] mt-1 text-[var(--text-tertiary)]">{formatTime(entry.timestamp)}</p>
            )}
          </>
        )}

        {/* Action bar (assistant only) */}
        {entry.role === 'assistant' && isLastAssistant && !streaming && entry.content && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-1.5 py-0.5 hover:bg-[var(--bg-primary)]"
            >
              <RefreshCw size={10} />
              {t('chat.regenerate')}
            </button>
          </div>
        )}

        {/* Sources */}
        {entry.sources && entry.sources.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-[var(--border-default)]/50">
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)] mb-1.5">
              {t('chat.sources.title')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.sources.map((source) => (
                <button
                  key={source.path}
                  onClick={() => onSourceClick(source.path)}
                  className="text-[10px] px-2 py-0.5 bg-[var(--bg-primary)] border border-apple-blue/20 text-apple-blue hover:underline truncate max-w-[200px] rounded-full"
                  title={source.path}
                >
                  {source.path}
                </button>
              ))}
            </div>
          </div>
        ) : entry.sources && entry.sources.length === 0 && entry.content ? (
          <div className="mt-3 pt-3 border-t border-[var(--border-default)]/50">
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {t('chat.noSources')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
});
