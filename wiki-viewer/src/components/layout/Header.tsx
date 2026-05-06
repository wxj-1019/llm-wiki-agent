import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Monitor, Network, Menu, X, Globe, Check } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { searchNodes } from '@/lib/search';
import { getPagePath } from '@/lib/wikilink';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { AppleSelect } from '@/components/ui/AppleSelect';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div className="relative w-36">
      <AppleSelect
        value={i18n.language}
        onChange={(code) => i18n.changeLanguage(code)}
        options={SUPPORTED_LANGUAGES.map((lang) => ({
          value: lang.code,
          label: lang.label,
          icon: <Globe size={14} />,
        }))}
      />
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
  const trapRef = useFocusTrap<HTMLDivElement>(searchOpen);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener('wiki:focus-search', handler);
    return () => window.removeEventListener('wiki:focus-search', handler);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 150);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
    <header className="fixed top-0 left-0 right-0 z-50 h-14 backdrop-blur-xl bg-[var(--bg-primary)]/75 border-b border-[var(--border-subtle)] flex items-center px-4 gap-3">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all border border-transparent hover:border-[var(--border-default)] min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-[0.97]"
        aria-label={sidebarCollapsed ? t('action.expandSidebar') : t('action.collapseSidebar')}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed ? <Menu size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
      </button>

      <Link to="/" className="font-semibold text-base tracking-tight flex items-center gap-2.5" aria-label={t('meta.homeAria')}>
        <img src="/logo.svg?v=6" alt="" className="w-7 h-7 rounded-lg" aria-hidden="true" />
        <span className="hidden sm:inline">{t('brand.name')}</span>
      </Link>

      <div className="flex-1" />

      <div className="relative" ref={searchRef}>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-all border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm active:scale-[0.97]"
          aria-label={t('action.search')}
          aria-expanded={searchOpen}
          aria-haspopup="dialog"
        >
          <Search size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{t('action.search')}</span>
          <kbd className="hidden md:inline-flex px-1.5 py-0.5 rounded-md text-[10px] bg-[var(--bg-primary)] border border-[var(--border-default)]">{t('shortcut.ctrlK')}</kbd>
        </button>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              ref={trapRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-3 z-50 shadow-xl"
            >
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              className="apple-input w-full text-sm"
              aria-label={t('action.search')}
              role="combobox"
              aria-controls="search-results"
              aria-expanded={results.length > 0}
              aria-activedescendant={selectedIdx >= 0 ? `search-result-${selectedIdx}` : undefined}
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
              <div className="mt-2 space-y-0" id="search-results" role="listbox">
                {results.map((r, idx) => (
                  <button
                    key={r.item.id}
                    id={`search-result-${idx}`}
                    onClick={() => handleResultClick(r.item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      idx === selectedIdx
                        ? 'bg-apple-blue/10 text-apple-blue'
                        : 'hover:bg-[var(--bg-secondary)]'
                    }`}
                    role="option"
                    aria-selected={idx === selectedIdx}
                  >
                    <div className="font-medium text-sm">{r.item.label}</div>
                    <div className="text-xs text-[var(--text-tertiary)] truncate">{r.item.preview}</div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <Link
        to="/graph"
        className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all border border-transparent hover:border-[var(--border-default)] min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-[0.97]"
        title={t('graph.tooltip')}
        aria-label={t('graph.tooltip')}
      >
        <Network size={16} aria-hidden="true" />
      </Link>

      <NotificationDropdown />

      <LanguageSwitcher />

      <div className="flex items-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] p-0.5">
        <button
          onClick={() => setTheme('light')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm' : ''}`}
          aria-label={t('theme.light')}
          aria-pressed={theme === 'light'}
        >
          <Sun size={14} aria-hidden="true" />
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'system' ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm' : ''}`}
          aria-label={t('theme.system')}
          aria-pressed={theme === 'system'}
        >
          <Monitor size={14} aria-hidden="true" />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm' : ''}`}
          aria-label={t('theme.dark')}
          aria-pressed={theme === 'dark'}
        >
          <Moon size={14} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
