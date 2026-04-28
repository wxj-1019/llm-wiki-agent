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
    set({ loading: true, error: null });
    try {
      const data = await fetchGraphData();
      initSearch(data.nodes);
      set({ graphData: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    persistState(get());
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
    persistState(get());
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
    persistState(get());
  },

  toggleFavorite: (pageId) => {
    set((s) => {
      const favorites = s.favorites.includes(pageId)
        ? s.favorites.filter((id) => id !== pageId)
        : [...s.favorites, pageId];
      return { favorites };
    });
    persistState(get());
  },

  isFavorite: (pageId) => get().favorites.includes(pageId),

  setReadingProgress: (pageId, progress) => {
    set((s) => {
      const readingProgress = { ...s.readingProgress, [pageId]: progress };
      return { readingProgress };
    });
    persistState(get());
  },
}));

function persistState(state: WikiState) {
  const data = {
    theme: state.theme,
    sidebarCollapsed: state.sidebarCollapsed,
    recentPages: state.recentPages,
    readingProgress: state.readingProgress,
    favorites: state.favorites,
  };
  localStorage.setItem('wiki-viewer-storage', JSON.stringify(data));
}

applyTheme(persisted.theme || 'system');
