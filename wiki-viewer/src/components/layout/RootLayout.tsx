import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { AlertTriangle, RefreshCw, WifiOff, Download, Sparkles } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSWUpdate } from '@/hooks/useSWUpdate';

export function RootLayout() {
  const { t } = useTranslation();
  const initialize = useWikiStore((s) => s.initialize);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const location = useLocation();
  const isOnline = useNetworkStatus();
  const { canInstall, install } = usePWAInstall();
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerHeight, setBannerHeight] = useState(0);

  const measureBanner = useCallback(() => {
    if (bannerRef.current) {
      setBannerHeight(bannerRef.current.offsetHeight);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    measureBanner();
    const observer = new ResizeObserver(measureBanner);
    if (bannerRef.current) observer.observe(bannerRef.current);
    return () => observer.disconnect();
  }, [measureBanner, isOnline, updateAvailable, canInstall]);

  // Scroll to top on route change, but skip detail pages (they restore scroll position)
  useEffect(() => {
    // Don't scroll for detail pages — PageDetailPage handles scroll restoration
    if (!location.pathname.match(/^\/(s|e|c|y)\//)) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-apple-blue focus:text-white focus:font-medium"
      >
        {t('action.skipToContent', 'Skip to content')}
      </a>
      <Header />
      <ToastContainer />
      <CommandPalette />
      <div ref={bannerRef} className="fixed top-14 left-0 right-0 z-[45]">
        {!isOnline && (
          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)] px-4 py-2 flex items-center justify-center gap-2 text-sm text-apple-blue" role="alert">
            <WifiOff size={14} aria-hidden="true" />
            <span>{t('error.offline')}</span>
          </div>
        )}
        {updateAvailable && (
          <div className="bg-apple-green/10 border-b border-apple-green/30 px-4 py-2 flex items-center justify-center gap-3 text-sm text-apple-green" role="alert">
            <Sparkles size={14} aria-hidden="true" />
            <span>{t('pwa.updateAvailable')}</span>
            <button onClick={applyUpdate} className="font-semibold underline hover:no-underline">
              {t('pwa.updateNow')}
            </button>
          </div>
        )}
        {canInstall && isOnline && !updateAvailable && (
          <div className="bg-apple-purple/10 border-b border-apple-purple/30 px-4 py-2 flex items-center justify-center gap-3 text-sm text-apple-purple" role="alert">
            <Download size={14} aria-hidden="true" />
            <span>{t('pwa.installPrompt')}</span>
            <button onClick={install} className="font-semibold underline hover:no-underline">
              {t('pwa.install')}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: `${56 + bannerHeight}px` }}>
        <Sidebar />
        {/*
          Desktop: margin-left matches sidebar (240px expanded, 56px collapsed).
          Mobile: sidebar is an overlay with backdrop, no margin needed.
          The `md:` prefix ensures these margins only apply on desktop (>=768px).
        */}
        <main
          id="main-content"
          className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-14' : 'md:ml-60'}`}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {loading ? (
              <div className="min-h-[60vh] py-8">
                <PageSkeleton />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <AlertTriangle size={40} className="text-apple-blue mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('error.loadFailed')}</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md text-center">{error}</p>
                <button
                  onClick={() => initialize()}
                  className="apple-button flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  {t('error.retry')}
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
