import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, MoreHorizontal, Download, Check, X } from 'lucide-react';

interface ChatHistoryItemProps {
  session: {
    id: string;
    title: string;
    message_count: number;
    updatedAt: number;
    isDefaultTitle: boolean;
  };
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ChatHistoryItem({
  session, isActive, onSwitch, onDelete, onRename,
}: ChatHistoryItemProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const editRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && editRef.current) editRef.current.focus();
  }, [editing]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDoubleClick = useCallback(() => {
    if (!session.isDefaultTitle) {
      setEditValue(session.title);
      setEditing(true);
    }
  }, [session.title, session.isDefaultTitle]);

  const submitRename = () => {
    if (editValue.trim() && editValue !== session.title) onRename(editValue.trim());
    setEditing(false);
  };

  const displayTitle = session.title || t('chat.sessionDefault', 'New Chat');

  return (
    <div className={`group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors
      ${isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}
    >
      {/* Active indicator */}
      {isActive && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-r-md" />}

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={onSwitch} onDoubleClick={handleDoubleClick}>
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={submitRename}
              className="flex-1 text-xs bg-[var(--bg-primary)] border border-blue-500 rounded px-1 py-0.5 text-[var(--text-primary)] outline-none"
            />
            <Check className="w-3 h-3 text-green-500 cursor-pointer" onClick={submitRename} />
            <X className="w-3 h-3 text-[var(--text-tertiary)] cursor-pointer" onClick={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <div className="text-xs font-medium text-[var(--text-primary)] truncate">{displayTitle}</div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <span>{session.message_count} msgs</span>
              <span>·</span>
              <span>{formatRelativeTime(session.updatedAt)}</span>
            </div>
          </>
        )}
      </div>

      {/* Context menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className={`p-0.5 rounded ${menuOpen ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'} opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 py-1">
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
              onClick={() => { setMenuOpen(false); handleDoubleClick(); }}
            >
              <span className="text-[var(--text-secondary)]">✏️</span> {t('chat.history.rename', 'Rename')}
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
              onClick={() => { setMenuOpen(false); }}
            >
              <Download className="w-3 h-3" /> {t('chat.history.export', 'Export')}
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              onClick={() => { setMenuOpen(false); onDelete(); }}
            >
              <Trash2 className="w-3 h-3" /> {t('chat.history.delete', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
