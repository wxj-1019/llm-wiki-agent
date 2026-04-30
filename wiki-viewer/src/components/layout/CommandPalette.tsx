import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers, Settings, Bot, Network, Upload, BookOpen, Home, Clock, Heart, Command } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { getPagePath } from '@/lib/wikilink';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
  action: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = graphData?.nodes ?? [];
  const recentPages = useWikiStore((s) => s.recentPages);
  const favorites = useWikiStore((s) => s.favorites);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
    source: { icon: FileText, color: 'text-apple-blue' },
    entity: { icon: Users, color: 'text-apple-green' },
    concept: { icon: Lightbulb, color: 'text-apple-purple' },
    synthesis: { icon: Layers, color: 'text-apple-orange' },
  };

  const staticCommands: CommandItem[] = useMemo(() => [
    { id: 'nav-home', label: 'Home', subtitle: 'Go to home page', icon: Home, action: () => navigate('/') },
    { id: 'nav-browse', label: 'Browse', subtitle: 'Browse all wiki pages', icon: BookOpen, action: () => navigate('/browse') },
    { id: 'nav-search', label: 'Search', subtitle: 'Full-text search', icon: Search, action: () => navigate('/search') },
    { id: 'nav-graph', label: 'Graph', subtitle: 'Knowledge graph visualization', icon: Network, action: () => navigate('/graph') },
    { id: 'nav-upload', label: 'Upload', subtitle: 'Upload new documents', icon: Upload, action: () => navigate('/upload') },
    { id: 'nav-agentkit', label: 'Agent Kit', subtitle: 'AI assistant & code generation', icon: Bot, action: () => navigate('/agent-kit') },
    { id: 'nav-settings', label: 'Settings', subtitle: 'Configure sources & LLM', icon: Settings, action: () => navigate('/settings') },
  ], [navigate]);

  const recentCommands: CommandItem[] = useMemo(() => {
    return recentPages
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
      .slice(0, 5)
      .map((node) => {
        const t = typeIcons[node!.type] || typeIcons.source;
        return {
          id: `recent-${node!.id}`,
          label: node!.label,
          subtitle: `Recently viewed · ${node!.type}`,
          icon: Clock,
          color: 'text-[var(--text-tertiary)]',
          action: () => navigate(getPagePath(node!)),
          keywords: node!.label.toLowerCase(),
        };
      });
  }, [recentPages, nodes, navigate]);

  const favCommands: CommandItem[] = useMemo(() => {
    return favorites
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
      .slice(0, 5)
      .map((node) => {
        const t = typeIcons[node!.type] || typeIcons.source;
        return {
          id: `fav-${node!.id}`,
          label: node!.label,
          subtitle: `Favorite · ${node!.type}`,
          icon: Heart,
          color: 'text-apple-pink',
          action: () => navigate(getPagePath(node!)),
          keywords: node!.label.toLowerCase(),
        };
      });
  }, [favorites, nodes, navigate]);

  const pageCommands: CommandItem[] = useMemo(() => {
    return nodes.map((node) => {
      const t = typeIcons[node.type] || typeIcons.source;
      return {
        id: `page-${node.id}`,
        label: node.label,
        subtitle: `${node.type} · ${node.preview.slice(0, 60)}`,
        icon: t.icon,
        color: t.color,
        action: () => navigate(getPagePath(node)),
        keywords: `${node.label.toLowerCase()} ${node.type}`,
      };
    });
  }, [nodes, navigate]);

  const allCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const separators: CommandItem[] = [];
      if (recentCommands.length) separators.push({ id: 'sep-recent', label: 'Recent', subtitle: '', icon: Search, action: () => {}, color: undefined, keywords: undefined });
      if (favCommands.length) separators.push({ id: 'sep-fav', label: 'Favorites', subtitle: '', icon: Search, action: () => {}, color: undefined, keywords: undefined });
      return [...staticCommands, ...separators, ...recentCommands, ...favCommands];
    }
    const results: CommandItem[] = [];
    // Static commands match
    staticCommands.forEach((cmd) => {
      if (cmd.label.toLowerCase().includes(q) || cmd.subtitle?.toLowerCase().includes(q)) {
        results.push(cmd);
      }
    });
    // Page matches
    pageCommands.forEach((cmd) => {
      if (cmd.keywords?.includes(q) || cmd.label.toLowerCase().includes(q)) {
        results.push(cmd);
      }
    });
    return results;
  }, [query, staticCommands, recentCommands, favCommands, pageCommands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allCommands.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % allCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + allCommands.length) % allCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = allCommands[selectedIndex];
      if (cmd && !cmd.id.startsWith('sep-')) {
        cmd.action();
        setOpen(false);
      }
    }
  }, [allCommands, selectedIndex]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border-default)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)]">
              <Search size={18} className="text-[var(--text-tertiary)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, navigate..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                aria-autocomplete="list"
                aria-controls="command-palette-results"
                aria-activedescendant={`cmd-item-${selectedIndex}`}
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--border-default)]">
                <Command size={10} />K
              </kbd>
            </div>
            {/* Results */}
            <div ref={scrollRef} className="max-h-[50vh] overflow-auto py-1" role="listbox" id="command-palette-results">
              {allCommands.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                  No results found.
                </div>
              )}
              {allCommands.map((cmd, i) => {
                if (cmd.id.startsWith('sep-')) {
                  return (
                    <div key={cmd.id} className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {cmd.label}
                    </div>
                  );
                }
                const isSelected = i === selectedIndex;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    id={`cmd-item-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { cmd.action(); setOpen(false); }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]/50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 ${cmd.color || 'text-[var(--text-secondary)]'}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{cmd.label}</div>
                      {cmd.subtitle && (
                        <div className="text-xs text-[var(--text-tertiary)] truncate">{cmd.subtitle}</div>
                      )}
                    </div>
                    {isSelected && (
                      <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-default)]">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--border-default)] flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]">↵</kbd> select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]">esc</kbd> close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
