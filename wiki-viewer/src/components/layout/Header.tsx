import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Monitor, Network, Menu, X, Globe, Check } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { searchNodes } from '@/lib/search';
import { getPagePath } from '@/lib/wikilink';
import { SUPPORTED_LANGUAGES } from '@/i18n';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors border border-transparent hover:border-[var(--border-default)]"
        title={t('action.switchLanguage')}
        onClick={() => setOpen(!open)}
      >
        <Globe size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 py-1 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] min-w-[140px] z-50 shadow-lg">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-between ${
                  i18n.language === lang.code ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {lang.label}
                {i18n.language === lang.code && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation();
  const theme = useWikiStore((s) => s.theme);
  const setTheme = useWikiStore((s) => s.setTheme);
  const graphData = useWikiStore((s) => s.graphData);
  const toggleSidebar = useWikiStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 150);
  };

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSelectedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const results = useMemo(
    () => (debouncedQuery ? searchNodes(debouncedQuery).slice(0, 6) : []),
    [debouncedQuery]
  );

  const handleResultClick = (id: string) => {
    const node = graphData?.nodes.find((n) => n.id === id);
    if (!node) return;
    navigate(getPagePath(node));
    setSearchOpen(false);
    setQuery('');
    setSelectedIdx(-1);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 backdrop-blur-md bg-[var(--bg-primary)]/80 border-b border-[var(--border-default)] flex items-center px-4 gap-3">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors border border-transparent hover:border-[var(--border-default)]"
      >
        {sidebarCollapsed ? <Menu size={16} /> : <X size={16} />}
      </button>

      <Link to="/" className="font-semibold text-base tracking-tight flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-apple-blue flex items-center justify-center text-white text-xs font-bold">W</span>
        <span className="hidden sm:inline">{t('brand.name')}</span>
      </Link>

      <div className="flex-1" />

      <div className="relative" ref={searchRef}>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-colors border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm"
        >
          <Search size={14} />
          <span className="hidden sm:inline">{t('action.search')}</span>
          <kbd className="hidden md:inline-flex px-1.5 py-0.5 rounded-md text-[10px] bg-[var(--bg-primary)] border border-[var(--border-default)]">{t('shortcut.ctrlK')}</kbd>
        </button>

        {searchOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-3 z-50 shadow-lg">
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              className="apple-input w-full text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                  setSelectedIdx(-1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIdx((prev) => Math.max(prev - 1, -1));
                } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
                  e.preventDefault();
                  handleResultClick(results[selectedIdx].item.id);
                }
              }}
            />
            {results.length > 0 && (
              <div className="mt-2 space-y-0">
                {results.map((r, idx) => (
                  <button
                    key={r.item.id}
                    onClick={() => handleResultClick(r.item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      idx === selectedIdx
                        ? 'bg-apple-blue/10 text-apple-blue'
                        : 'hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="font-medium text-sm">{r.item.label}</div>
                    <div className="text-xs text-[var(--text-tertiary)] truncate">{r.item.preview}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Link
        to="/graph"
        className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors border border-transparent hover:border-[var(--border-default)]"
        title={t('graph.tooltip')}
      >
        <Network size={16} />
      </Link>

      <NotificationDropdown />

      <LanguageSwitcher />

      <div className="flex items-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] p-0.5">
        <button
          onClick={() => setTheme('light')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm' : ''}`}
        >
          <Sun size={14} />
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'system' ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm' : ''}`}
        >
          <Monitor size={14} />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm' : ''}`}
        >
          <Moon size={14} />
        </button>
      </div>
    </header>
  );
}
