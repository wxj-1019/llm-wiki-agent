import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { GlassHeader } from './GlassHeader';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function RootLayout() {
  const { t } = useTranslation();
  const initialize = useWikiStore((s) => s.initialize);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const location = useLocation();
  const isOnline = useNetworkStatus();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Scroll to top on route change, but skip detail pages (they restore scroll position)
  useEffect(() => {
    // Don't scroll for detail pages �?PageDetailPage handles scroll restoration
    if (!location.pathname.match(/^\/(s|e|c|y)\//)) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <GlassHeader />
      <CommandPalette />
      {!isOnline && (
        <div className="fixed top-14 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40 px-4 py-2 flex items-center justify-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <WifiOff size={14} />
          <span>{t('error.offline')}</span>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden pt-14">
        <Sidebar />
        {/*
          Desktop: margin-left matches sidebar (240px expanded, 56px collapsed).
          Mobile: sidebar is an overlay with backdrop, no margin needed.
          The `md:` prefix ensures these margins only apply on desktop (>=768px).
        */}
        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-14' : 'md:ml-60'}`}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {loading ? (
              <div className="min-h-[60vh] py-8">
                <PageSkeleton />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <AlertTriangle size={40} className="text-apple-orange mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('error.loadFailed')}</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md text-center">{error}</p>
                <button
                  onClick={() => initialize()}
                  className="apple-button-warm flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  {t('error.retry')}
                </button>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
