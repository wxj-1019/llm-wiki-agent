import { useTranslation } from 'react-i18next';
import { Square, ArrowUp, Search, FileText, Zap, Plug, ChevronDown, MoreHorizontal, Globe, BookOpen, Pencil, Wand2 } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  streaming: boolean;
  online: boolean;
  onSearchOpen: () => void;
  onSummarize: (style: string) => void;
  onGenerate: (target: 'skill' | 'mcp') => void;
  onRefine: () => void;
  showSummarizeMenu: boolean;
  setShowSummarizeMenu: (v: boolean) => void;
  showMoreMenu: boolean;
  setShowMoreMenu: (v: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function ChatInput({
  value, onChange, onSend, onStop, loading, streaming, online,
  onSearchOpen, onSummarize, onGenerate, onRefine,
  showSummarizeMenu, setShowSummarizeMenu, showMoreMenu, setShowMoreMenu,
  textareaRef,
}: ChatInputProps) {
  const { t } = useTranslation();
  const summarizeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [value, textareaRef]);

  // Close menus on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (summarizeMenuRef.current && !summarizeMenuRef.current.contains(e.target as Node)) setShowSummarizeMenu(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setShowSummarizeMenu, setShowMoreMenu]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  };

  return (
    <div className="border-t border-[var(--border-default)] bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 pt-2">
        {/* Search */}
        <button
          onClick={onSearchOpen}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          title={t('chat.search', 'Search')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Summarize */}
        <div className="relative" ref={summarizeMenuRef}>
          <button
            onClick={() => setShowSummarizeMenu(!showSummarizeMenu)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
            title={t('chat.summarize', 'Summarize')}
          >
            <FileText className="w-4 h-4" />
          </button>
          {showSummarizeMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-36 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 py-1">
              {[
                { key: 'brief', label: t('chat.summarizeBrief', 'Brief') },
                { key: 'detailed', label: t('chat.summarizeDetailed', 'Detailed') },
                { key: 'bullet', label: t('chat.summarizeBullet', 'Bullet Points') },
                { key: 'action', label: t('chat.summarizeAction', 'Action Items') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  onClick={() => { setShowSummarizeMenu(false); onSummarize(key); }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Generate Skill/MCP */}
        <button
          onClick={() => onGenerate('skill')}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          title={t('chat.generateSkill', 'Generate Skill')}
        >
          <Zap className="w-4 h-4" />
        </button>
        <button
          onClick={() => onGenerate('mcp')}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          title={t('chat.generateMCP', 'Generate MCP')}
        >
          <Plug className="w-4 h-4" />
        </button>

        {/* More menu */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMoreMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-40 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 py-1">
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                onClick={() => { setShowMoreMenu(false); onSearchOpen(); }}
              >
                <Globe className="w-3 h-3" /> {t('chat.searchWeb', 'Web Search')}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                onClick={() => { setShowMoreMenu(false); }}
              >
                <BookOpen className="w-3 h-3" /> {t('chat.searchWiki', 'Wiki Search')}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                onClick={() => { setShowMoreMenu(false); onRefine(); }}
              >
                <Wand2 className="w-3 h-3" /> {t('chat.refine', 'Refine')}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                onClick={() => { setShowMoreMenu(false); }}
              >
                <Pencil className="w-3 h-3" /> {t('chat.editCode', 'Edit Code')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 pb-3 pt-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={online ? t('chat.placeholder', 'Ask about your wiki...') : t('chat.offline', 'Offline mode')}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none py-2 max-h-[160px]"
          disabled={!online}
        />
        <button
          onClick={streaming ? onStop : onSend}
          disabled={!online || (!streaming && !value.trim())}
          className={`p-2 rounded-lg transition-all ${
            streaming
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {streaming ? <Square className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
