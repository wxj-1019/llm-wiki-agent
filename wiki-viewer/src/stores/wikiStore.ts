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

import { safeGet, safeSet, isObject } from '@/lib/safeStorage';

const persisted = safeGet('wiki-viewer-storage', isObject, {});

const GRAPH_CACHE_KEY = 'wiki-graph-cache';
const GRAPH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function loadGraphCache(): GraphData | null {
  const parsed = safeGet(GRAPH_CACHE_KEY, isObject, null);
  if (!parsed) return null;
  if (Date.now() - (parsed._cachedAt as number || 0) > GRAPH_CACHE_TTL_MS) return null;
  const data = parsed.data;
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
  return data as GraphData;
}

function saveGraphCache(data: GraphData) {
  safeSet(GRAPH_CACHE_KEY, { data, _cachedAt: Date.now() });
}

// ── Debounced persistence ──
// Scroll-triggered state (readingProgress) fires ~100 times per article read.
// We debounce localStorage writes to 1 second to avoid blocking the main thread.
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    const state = useWikiStore.getState();
    writePersist(state);
  }, 1000);
}
function persistNow() {
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
  const state = useWikiStore.getState();
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
  safeSet('wiki-viewer-storage', data);
}

function persistState(state: WikiState) {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => writePersist(state), 500);
}

const MAX_READING_PROGRESS = 100;

let _initPromise: Promise<void> | null = null;

export const useWikiStore = create<WikiState>((set, get) => ({
  graphData: null,
  theme: (persisted.theme as WikiState['theme']) || 'system',
  sidebarCollapsed: (persisted.sidebarCollapsed as boolean) ?? false,
  loading: false,
  error: null,
  recentPages: (persisted.recentPages as string[]) || [],
  readingProgress: (persisted.readingProgress as Record<string, number>) || {},
  favorites: (persisted.favorites as string[]) || [],
  commandPaletteOpen: false,

  initialize: async () => {
    const { graphData } = get();
    if (graphData) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
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
      } finally {
        _initPromise = null;
      }
    })();
    return _initPromise;
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
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
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
  },

  toggleFavorite: (pageId) => {
    set((s) => {
      const favorites = s.favorites.includes(pageId)
        ? s.favorites.filter((id) => id !== pageId)
        : [...s.favorites, pageId];
      return { favorites };
    });
  },

  isFavorite: (pageId) => get().favorites.includes(pageId),

  setReadingProgress: (pageId, progress) => {
    set((s) => {
      const readingProgress = { ...s.readingProgress, [pageId]: progress };
      // LRU eviction: keep only the most recent MAX_READING_PROGRESS entries
      const keys = Object.keys(readingProgress);
      if (keys.length > MAX_READING_PROGRESS) {
        const sorted = keys.sort((a, b) => (readingProgress[a] ?? 0) - (readingProgress[b] ?? 0));
        const toDelete = sorted.slice(0, keys.length - MAX_READING_PROGRESS);
        for (const k of toDelete) delete readingProgress[k];
      }
      return { readingProgress };
    });
  },
}));

// Auto-persist when relevant fields change
useWikiStore.subscribe((state, prevState) => {
  if (
    state.theme !== prevState.theme ||
    state.sidebarCollapsed !== prevState.sidebarCollapsed ||
    state.recentPages !== prevState.recentPages ||
    state.readingProgress !== prevState.readingProgress ||
    state.favorites !== prevState.favorites
  ) {
    persistState(state);
  }
});

applyTheme((persisted.theme as WikiState['theme']) || 'system');
