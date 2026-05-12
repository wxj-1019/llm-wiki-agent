import { memo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy, Check, RefreshCw, Pencil, Trash2, CornerDownLeft,
  Bookmark, Quote, SquarePen, ArrowDown
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { WikiChatSource } from '@/services/chatService';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: WikiChatSource[];
  timestamp?: number;
  truncated?: boolean;
  bookmarked?: boolean;
  meta?: { type: 'summary'; style: string };
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
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onSaveSummary?: () => void;
  onQuoteSummary?: () => void;
  onContinue?: () => void;
  onReply?: () => void;
  onToggleBookmark?: () => void;
  truncated?: boolean;
  bookmarked?: boolean;
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
  onEdit,
  onDelete,
  onSaveSummary,
  onQuoteSummary,
  onContinue,
  onReply,
  onToggleBookmark,
  truncated,
  bookmarked,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(entry.content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isUser = entry.role === 'user';
  const isAssistant = entry.role === 'assistant';
  const isCopied = copiedIndex === index;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editValue.length, editValue.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== entry.content && onEdit) {
      onEdit(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(entry.content);
    }
  };

  const actionBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active?: boolean,
    danger?: boolean
  ) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
        danger
          ? 'text-apple-red/70 hover:text-apple-red hover:bg-apple-red/10'
          : active
          ? 'text-apple-yellow hover:bg-apple-yellow/10'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group/message`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex items-end gap-2.5 max-w-[92%] sm:max-w-[82%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        {isAssistant ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-apple-blue/20 to-purple-500/20 border border-apple-blue/15 flex items-center justify-center shrink-0 shadow-sm">
            <SparkleIcon size={15} className="text-apple-blue" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-[11px] text-white font-semibold">Me</span>
          </div>
        )}

        {/* Content column */}
        <div className={`flex flex-col max-w-full ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Bubble */}
          <div
            className={`relative px-4 py-3 rounded-2xl shadow-sm w-fit ${
              isUser
                ? 'bg-apple-blue text-white rounded-br-sm max-w-[320px] sm:max-w-[480px]'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-bl-sm max-w-[85vw] sm:max-w-[640px]'
            }`}
          >
            {/* Message tail */}
            <div
              className={`absolute bottom-0 w-3 h-3 ${
                isUser ? '-right-[10px] bg-apple-blue' : '-left-[10px] bg-[var(--bg-secondary)] border-l border-b border-[var(--border-default)]'
              }`}
              style={
                isUser
                  ? { clipPath: 'polygon(0 0, 0% 100%, 100% 100%)' }
                  : { clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)', marginBottom: '-1px' }
              }
            />

            {/* Bookmark indicator */}
            {bookmarked && (
              <Bookmark size={10} className="absolute top-2.5 right-2.5 text-apple-yellow fill-apple-yellow" />
            )}

            {/* Content */}
            {isUser && isEditing ? (
              <div className="min-w-[240px]">
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/40 resize-none"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-white transition-colors font-medium"
                  >
                    {t('common.save', 'Save')}
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditValue(entry.content); }}
                    className="text-xs px-3 py-1 text-white/50 hover:text-white transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            ) : isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{entry.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none">
                {entry.content ? (
                  <MarkdownRenderer
                    content={entry.content}
                    enableSourceCitations
                    onSourceClick={onSourceClick}
                  />
                ) : entry.sources && entry.sources.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <TypingIndicator />
                    {t('chat.typing')}
                  </div>
                ) : streaming && isLastAssistant ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <TypingIndicator />
                    {t('chat.searching')}
                  </div>
                ) : null}
              </div>
            )}

            {/* Sources */}
            {isAssistant && entry.sources && entry.sources.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-[var(--border-default)]/40">
                <p className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">
                  {t('chat.sources.title')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.sources.map((source) => (
                    <button
                      key={source.path}
                      onClick={() => onSourceClick(source.path)}
                      role="link"
                      className="text-[10px] px-2.5 py-1 bg-[var(--bg-primary)]/60 border border-apple-blue/15 text-apple-blue hover:bg-apple-blue/5 hover:border-apple-blue/30 transition-colors truncate max-w-[200px] rounded-full"
                      title={source.path}
                    >
                      {source.path}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Continue button */}
            {isAssistant && truncated && !streaming && (
              <button
                onClick={onContinue}
                className="mt-2.5 flex items-center gap-1.5 text-xs text-apple-blue hover:text-apple-blue/80 font-medium transition-colors"
              >
                <ArrowDown size={12} />
                {t('chat.continue', 'Continue')}
              </button>
            )}
          </div>

          {/* Action bar — below bubble, never overlaps content */}
          {!isEditing && (
            <div
              className={`flex items-center flex-wrap gap-0.5 mt-1 transition-all duration-150 ${
                showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {entry.content && actionBtn(
                isCopied ? t('chat.copied', 'Copied') : t('chat.copy', 'Copy'),
                isCopied ? <Check size={11} className="text-apple-green" /> : <Copy size={11} />,
                () => onCopy(entry.content, index)
              )}

              {isUser && onEdit && actionBtn(
                t('chat.edit', 'Edit'),
                <Pencil size={11} />,
                () => setIsEditing(true)
              )}

              {onReply && actionBtn(
                t('chat.reply', 'Reply'),
                <CornerDownLeft size={11} />,
                onReply
              )}

              {onToggleBookmark && actionBtn(
                bookmarked ? t('chat.unbookmark', 'Unbookmark') : t('chat.bookmark', 'Bookmark'),
                <Bookmark size={11} className={bookmarked ? 'fill-apple-yellow text-apple-yellow' : ''} />,
                onToggleBookmark,
                bookmarked
              )}

              {isAssistant && isLastAssistant && !streaming && actionBtn(
                t('chat.regenerate', 'Regenerate'),
                <RefreshCw size={11} />,
                onRegenerate
              )}

              {entry.meta?.type === 'summary' && onSaveSummary && actionBtn(
                t('chat.saveSummary', 'Save'),
                <SquarePen size={11} />,
                onSaveSummary
              )}
              {entry.meta?.type === 'summary' && onQuoteSummary && actionBtn(
                t('chat.quoteSummary', 'Quote'),
                <Quote size={11} />,
                onQuoteSummary
              )}

              {onDelete && actionBtn(
                t('chat.delete', 'Delete'),
                <Trash2 size={11} />,
                onDelete,
                false,
                true
              )}
            </div>
          )}

          {/* Timestamp */}
          {entry.timestamp && (
            <p className={`text-[10px] mt-0.5 text-[var(--text-tertiary)] opacity-0 group-hover/message:opacity-100 transition-opacity duration-200 ${isUser ? 'text-right' : 'text-left'}`}>
              {formatTime(entry.timestamp)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

/* Sparkle icon */
function SparkleIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
