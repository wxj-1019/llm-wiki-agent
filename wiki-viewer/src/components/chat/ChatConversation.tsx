import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { WikiChatSource } from '@/services/chatService';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: WikiChatSource[];
  timestamp?: number;
  meta?: { type: 'summary'; style: string };
  truncated?: boolean;
  bookmarked?: boolean;
}

interface ChatConversationProps {
  entries: ChatEntry[];
  loading: boolean;
  streaming: boolean;
  showScrollToBottom: boolean;
  copiedIndex: number | null;
  onCopy: (content: string, index: number) => void;
  onReply: (index: number) => void;
  onToggleBookmark: (index: number) => void;
  onContinue: (index: number) => void;
  onSourceClick: (path: string) => void;
  onDelete: (index: number) => void;
  onEdit: (index: number, content: string) => void;
  onRegenerate: () => void;
  onScrollToBottom: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  renderWindow: number;
  findQuery: string;
}

function formatTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(ts?: number, t?: (key: string) => string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return t?.('date.today') || 'Today';
  if (d.toDateString() === yesterday.toDateString()) return t?.('date.yesterday') || 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ChatConversation({
  entries, loading, streaming, showScrollToBottom, copiedIndex,
  onCopy, onReply, onToggleBookmark, onContinue, onSourceClick,
  onDelete, onEdit, onRegenerate, onScrollToBottom, scrollRef,
  renderWindow, findQuery,
}: ChatConversationProps) {
  const { t } = useTranslation();

  // Virtual scroll: only render recent entries
  const visibleEntries = entries.length > renderWindow
    ? entries.slice(-renderWindow)
    : entries;
  const virtualOffset = entries.length - visibleEntries.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
        {virtualOffset > 0 && (
          <div className="text-center py-2">
            <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-3 py-1 rounded-full">
              {virtualOffset} {t('chat.earlierMessages', 'earlier messages')}
            </span>
          </div>
        )}

        {visibleEntries.map((entry, i) => {
          const realIndex = i + virtualOffset;
          const prevEntry = entries[realIndex - 1];
          const showDivider = !prevEntry || (
            entry.timestamp && prevEntry.timestamp &&
            new Date(entry.timestamp).toDateString() !== new Date(prevEntry.timestamp).toDateString()
          );

          return (
            <div key={entry.id || `${realIndex}`}>
              {showDivider && entry.timestamp && (
                <div className="flex items-center my-3">
                  <div className="flex-1 border-t border-[var(--border-default)]" />
                  <span className="mx-3 text-xs text-[var(--text-tertiary)] font-medium">
                    {formatDateDivider(entry.timestamp, t)}
                  </span>
                  <div className="flex-1 border-t border-[var(--border-default)]" />
                </div>
              )}
              <ChatMessage
                entry={entry}
                index={realIndex}
                isLastAssistant={false}
                streaming={streaming}
                copiedIndex={copiedIndex}
                onCopy={onCopy}
                onRegenerate={onRegenerate}
                onReply={() => onReply(realIndex)}
                onToggleBookmark={() => onToggleBookmark(realIndex)}
                onContinue={() => onContinue(realIndex)}
                onSourceClick={onSourceClick}
                onDelete={() => onDelete(realIndex)}
                onEdit={(content: string) => onEdit(realIndex, content)}
              />
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && !streaming && (
          <div className="flex items-center gap-2 py-3 text-[var(--text-tertiary)] text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            {t('chat.thinking', 'Thinking...')}
          </div>
        )}

        {entries.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <MessageCircleIcon />
            <p className="text-sm text-[var(--text-secondary)] mt-3">{t('chat.empty', 'Ask anything about your wiki')}</p>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-full shadow-md hover:bg-[var(--bg-hover)] transition-colors z-10"
        >
          <ArrowDown className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      )}
    </div>
  );
}

function MessageCircleIcon() {
  return (
    <svg className="w-12 h-12 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
