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

  const actionIcon = (
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
    active?: boolean,
    danger?: boolean
  ) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 ${
        danger
          ? 'text-apple-red/70 hover:text-apple-red hover:bg-apple-red/10'
          : active
          ? 'text-apple-yellow hover:bg-apple-yellow/10'
          : 'text-white/50 hover:text-white hover:bg-white/10'
      }`}
      title={label}
    >
      {icon}
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
        <div className="flex flex-col min-w-0">
          {/* Bubble */}
          <div
            className={`relative px-4 py-3 rounded-2xl shadow-sm ${
              isUser
                ? 'bg-apple-blue text-white rounded-br-sm'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-bl-sm'
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

            {/* Inline action bar — inside bubble, bottom-right */}
            {!isEditing && (
              <div
                className={`absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-lg px-1 py-0.5 transition-all duration-200 ${
                  isUser
                    ? 'bg-white/10 backdrop-blur-sm'
                    : 'bg-[var(--bg-primary)]/80 backdrop-blur-sm border border-[var(--border-default)]/50'
                } ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}
              >
                {entry.content && actionIcon(
                  () => onCopy(entry.content, index),
                  isCopied ? <Check size={12} className="text-apple-green" /> : <Copy size={12} />,
                  isCopied ? t('chat.copied', 'Copied') : t('chat.copy', 'Copy')
                )}
                {isUser && onEdit && actionIcon(
                  () => setIsEditing(true),
                  <Pencil size={12} />,
                  t('chat.edit', 'Edit')
                )}
                {onReply && actionIcon(
                  onReply,
                  <CornerDownLeft size={12} />,
                  t('chat.reply', 'Reply')
                )}
                {onToggleBookmark && actionIcon(
                  onToggleBookmark,
                  <Bookmark size={12} className={bookmarked ? 'fill-apple-yellow text-apple-yellow' : ''} />,
                  bookmarked ? t('chat.unbookmark', 'Unbookmark') : t('chat.bookmark', 'Bookmark'),
                  bookmarked
                )}
                {isAssistant && isLastAssistant && !streaming && actionIcon(
                  onRegenerate,
                  <RefreshCw size={12} />,
                  t('chat.regenerate', 'Regenerate')
                )}
                {entry.meta?.type === 'summary' && onSaveSummary && actionIcon(
                  onSaveSummary,
                  <SquarePen size={12} />,
                  t('chat.saveSummary', 'Save')
                )}
                {entry.meta?.type === 'summary' && onQuoteSummary && actionIcon(
                  onQuoteSummary,
                  <Quote size={12} />,
                  t('chat.quoteSummary', 'Quote')
                )}
                {onDelete && actionIcon(
                  onDelete,
                  <Trash2 size={12} />,
                  t('chat.delete', 'Delete'),
                  false,
                  true
                )}
              </div>
            )}

            {/* Content */}
            {isUser && isEditing ? (
              <div className="min-w-[240px] pr-8">
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
              <div className="pr-6">
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{entry.content}</p>
              </div>
            ) : (
              <div className="pr-6">
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

          {/* Timestamp */}
          {entry.timestamp && (
            <p className={`text-[10px] mt-1 text-[var(--text-tertiary)] opacity-0 group-hover/message:opacity-100 transition-opacity duration-200 ${isUser ? 'text-right' : 'text-left'}`}>
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
