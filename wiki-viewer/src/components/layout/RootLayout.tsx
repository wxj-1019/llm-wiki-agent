import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useWikiStore } from '@/stores/wikiStore';
import { GlassHeader } from './GlassHeader';
import { Sidebar } from './Sidebar';

export function RootLayout() {
  const initialize = useWikiStore((s) => s.initialize);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <GlassHeader />
      <div className="flex flex-1 overflow-hidden pt-14">
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto transition-all duration-300"
          style={{ marginLeft: sidebarCollapsed ? '56px' : '240px' }}
        >
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
