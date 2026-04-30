import { create } from 'zustand';
import { fetchGraphData } from '@/services/dataService';
import { initSearch } from '@/lib/search';
import type { GraphData, GraphNode } from '@/types/graph';

interface WikiState {
  graphData: GraphData | null;
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  loading: boolean;
  error: string | null;
  recentPages: string[];
  readingProgress: Record<string, number>;
  favorites: string[];
  commandPaletteOpen: boolean;
  initialize: () => Promise<void>;
  refreshGraphData: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  getNodeById: (id: string) => GraphNode | undefined;
  getNodeByLabel: (label: string) => GraphNode | undefined;
  getBacklinks: (nodeId: string) => GraphNode[];
  addRecentPage: (pageId: string) => void;
  toggleFavorite: (pageId: string) => void;
  isFavorite: (pageId: string) => boolean;
  setReadingProgress: (pageId: string, progress: number) => void;
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const effective = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effective);
}

const persisted = (() => {
  try {
    return JSON.parse(localStorage.getItem('wiki-viewer-storage') || '{}');
  } catch {
    return {};
  }
})();

const GRAPH_CACHE_KEY = 'wiki-graph-cache';
const GRAPH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function loadGraphCache(): GraphData | null {
  try {
    const raw = localStorage.getItem(GRAPH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._cachedAt || 0) > GRAPH_CACHE_TTL_MS) return null;
    return parsed.data as GraphData;
  } catch {
    return null;
  }
}

function saveGraphCache(data: GraphData) {
  try {
    localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify({ data, _cachedAt: Date.now() }));
  } catch {
    // localStorage may be full — ignore
  }
}

// ── Debounced persistence ──
// Scroll-triggered state (readingProgress) fires ~100 times per article read.
// We debounce localStorage writes to 1 second to avoid blocking the main thread.
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(state: WikiState) {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => writePersist(state), 1000);
}
function persistNow(state: WikiState) {
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
  writePersist(state);
}
function writePersist(state: WikiState) {
  const data = {
    theme: state.theme,
    sidebarCollapsed: state.sidebarCollapsed,
    recentPages: state.recentPages,
    readingProgress: state.readingProgress,
    favorites: state.favorites,
  };
  localStorage.setItem('wiki-viewer-storage', JSON.stringify(data));
}

export const useWikiStore = create<WikiState>((set, get) => ({
  graphData: null,
  theme: persisted.theme || 'system',
  sidebarCollapsed: persisted.sidebarCollapsed ?? false,
  loading: false,
  error: null,
  recentPages: persisted.recentPages || [],
  readingProgress: persisted.readingProgress || {},
  favorites: persisted.favorites || [],
  commandPaletteOpen: false,

  initialize: async () => {
    const { graphData } = get();
    if (graphData) return;

    // Try loading from cache first for instant render
    const cached = loadGraphCache();
    if (cached) {
      initSearch(cached.nodes);
      set({ graphData: cached, loading: false });
      // Silently refresh in background
      try {
        const data = await fetchGraphData();
        initSearch(data.nodes);
        set({ graphData: data, loading: false });
        saveGraphCache(data);
      } catch {
        // Keep cached data on refresh failure
      }
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await fetchGraphData();
      initSearch(data.nodes);
      set({ graphData: data, loading: false });
      saveGraphCache(data);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  refreshGraphData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchGraphData();
      initSearch(data.nodes);
      set({ graphData: data, loading: false });
      saveGraphCache(data);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    persistNow(get());
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
    persistNow(get());
  },

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  getNodeById: (id) => {
    return get().graphData?.nodes.find((n) => n.id === id);
  },

  getNodeByLabel: (label) => {
    return get().graphData?.nodes.find((n) => n.label === label);
  },

  getBacklinks: (nodeId) => {
    const { graphData } = get();
    if (!graphData) return [];
    const fromIds = new Set(
      graphData.edges.filter((e) => e.to === nodeId).map((e) => e.from)
    );
    return graphData.nodes.filter((n) => fromIds.has(n.id));
  },

  addRecentPage: (pageId) => {
    set((s) => {
      const filtered = s.recentPages.filter((id) => id !== pageId);
      const recentPages = [pageId, ...filtered].slice(0, 20);
      return { recentPages };
    });
    persistNow(get());
  },

  toggleFavorite: (pageId) => {
    set((s) => {
      const favorites = s.favorites.includes(pageId)
        ? s.favorites.filter((id) => id !== pageId)
        : [...s.favorites, pageId];
      return { favorites };
    });
    persistNow(get());
  },

  isFavorite: (pageId) => get().favorites.includes(pageId),

  setReadingProgress: (pageId, progress) => {
    set((s) => {
      const readingProgress = { ...s.readingProgress, [pageId]: progress };
      return { readingProgress };
    });
    schedulePersist(get());
  },
}));

applyTheme(persisted.theme || 'system');
