import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Monitor, Network, Menu, X } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { searchNodes } from '@/lib/search';

export function GlassHeader() {
  const theme = useWikiStore((s) => s.theme);
  const setTheme = useWikiStore((s) => s.setTheme);
  const graphData = useWikiStore((s) => s.graphData);
  const toggleSidebar = useWikiStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const results = query ? searchNodes(query).slice(0, 6) : [];

  const handleResultClick = (id: string) => {
    const node = graphData?.nodes.find((n) => n.id === id);
    if (!node) return;
    const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
    const prefix = prefixMap[node.type] || 's';
    const slug = node.id.split('/').pop() || id;
    navigate(`/${prefix}/${slug}`);
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 glass border-b border-[var(--border-default)] flex items-center px-4 gap-3">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
      >
        {sidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
      </button>

      <Link to="/" className="font-semibold text-lg tracking-tight flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-apple-blue flex items-center justify-center text-white text-xs font-bold">W</span>
        <span className="hidden sm:inline">LLM Wiki</span>
      </Link>

      <div className="flex-1" />

      <div className="relative">
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">Ctrl K</kbd>
        </button>

        {searchOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 glass rounded-2xl shadow-apple-lg p-3 z-50">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search wiki..."
              className="apple-input w-full text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false);
              }}
            />
            {results.length > 0 && (
              <div className="mt-2 space-y-1">
                {results.map((r) => (
                  <button
                    key={r.item.id}
                    onClick={() => handleResultClick(r.item.id)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors"
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
        className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
        title="Knowledge Graph"
      >
        <Network size={18} />
      </Link>

      <div className="flex items-center bg-[var(--bg-secondary)] rounded-full p-0.5">
        <button
          onClick={() => setTheme('light')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-[var(--bg-primary)] shadow-sm' : ''}`}
        >
          <Sun size={14} />
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'system' ? 'bg-[var(--bg-primary)] shadow-sm' : ''}`}
        >
          <Monitor size={14} />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-[var(--bg-primary)] shadow-sm' : ''}`}
        >
          <Moon size={14} />
        </button>
      </div>
    </header>
  );
}
