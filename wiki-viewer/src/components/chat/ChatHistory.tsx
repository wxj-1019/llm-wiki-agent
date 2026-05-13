import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChatHistoryItem } from './ChatHistoryItem';

export interface ChatSession { id: string; title: string; messages: { role: string }[]; updatedAt: number; isDefaultTitle: boolean; }

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function groupByDate(sessions: ChatSession[], t: (key: string) => string): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekStart = new Date(today.getTime() - today.getDay() * 86400000);

  const groups: Record<string, ChatSession[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] };
  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dateOnly.getTime() >= today.getTime()) groups.today.push(s);
    else if (dateOnly.getTime() >= yesterday.getTime()) groups.yesterday.push(s);
    else if (dateOnly.getTime() >= weekStart.getTime()) groups.thisWeek.push(s);
    else groups.earlier.push(s);
  }

  const labels: Record<string, string> = {
    today: t('chat.history.today'),
    yesterday: t('chat.history.yesterday'),
    thisWeek: t('chat.history.thisWeek'),
    earlier: t('chat.history.earlier'),
  };
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([key, items]) => ({ label: labels[key] || key, items }));
}

export function ChatHistory({
  sessions, activeId, onSwitch, onNew, onDelete, onRename, collapsed, onToggleCollapse,
}: ChatHistoryProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => groupByDate(filtered, t), [filtered, t]);

  useEffect(() => {
    if (!collapsed && inputRef.current) inputRef.current.focus();
  }, [collapsed]);

  if (collapsed) {
    return (
      <motion.button
        className="flex-shrink-0 w-10 border-r border-[var(--border-default)] flex items-start justify-center pt-3 hover:bg-[var(--bg-hover)] transition-colors"
        onClick={onToggleCollapse}
        title={t('chat.history.title', 'History')}
        initial={{ width: 0 }}
        animate={{ width: 40 }}
      >
        <MessageSquareIcon />
      </motion.button>
    );
  }

  return (
    <motion.div
      className="w-[260px] min-w-[260px] border-r border-[var(--border-default)] flex flex-col overflow-hidden"
      initial={{ width: 0 }}
      animate={{ width: 260 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-default)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {t('chat.history.title', 'History')}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onNew}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              title={t('chat.history.newSession', 'New Chat')}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('chat.history.search', 'Search sessions...')}
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-2 mb-1">
              {group.label}
            </div>
            {group.items.map((session) => (
              <ChatHistoryItem
                key={session.id}
                session={{ ...session, message_count: session.messages.length }}
                isActive={session.id === activeId}
                onSwitch={() => onSwitch(session.id)}
                onDelete={() => onDelete(session.id)}
                onRename={(title) => onRename(session.id, title)}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-xs text-[var(--text-tertiary)] py-8">
            {searchQuery ? t('chat.history.noResults', 'No results') : t('chat.history.empty', 'No sessions')}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MessageSquareIcon() {
  return (
    <svg className="w-5 h-5 text-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
