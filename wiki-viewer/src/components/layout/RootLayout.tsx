import { useOutlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { IngestProgress } from '@/components/upload/IngestProgress';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ScrollToTop } from '@/components/ui/ScrollToTop';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSWUpdate } from '@/hooks/useSWUpdate';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useEventStream } from '@/hooks/useEventStream';

function getPageAnimation(pathname: string) {
  if (pathname === '/graph' || pathname.startsWith('/mindmap')) {
    return { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration: 0.25 } };
  }
  if (pathname.startsWith('/upload') || pathname.startsWith('/chat') || pathname.startsWith('/settings') || pathname.startsWith('/status') || pathname.startsWith('/mcp') || pathname.startsWith('/skills') || pathname.startsWith('/dashboard') || pathname.startsWith('/crawler') || pathname.startsWith('/timeline')) {
    return { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 }, transition: { duration: 0.2 } };
  }
  return { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };
}

function PageTransition({ pathname, isGraphPage, children }: { pathname: string; isGraphPage: boolean; children: React.ReactNode }) {
  const anim = getPageAnimation(pathname);
  return (
    <motion.div
      className="h-full"
      initial={anim.initial}
      animate={anim.animate}
      exit={anim.exit}
      transition={anim.transition}
    >
      {children}
    </motion.div>
  );
}

export function RootLayout() {
  useKeyboardShortcuts();
  const { t } = useTranslation();
  const initialize = useWikiStore((s) => s.initialize);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const apiConnected = useWikiStore((s) => s.apiConnected);
  const location = useLocation();
  const element = useOutlet();
  const isGraphPage = location.pathname === '/graph';
  const isOnline = useNetworkStatus();
  const { canInstall, install } = usePWAInstall();
  const { updateAvailable, applyUpdate } = useSWUpdate();
  useKeyboardShortcuts();

  // B3: subscribe to alert count for ResizeObserver dependency
  const alertCount = useNotificationStore(
    (s) => s.notifications.filter((n) => n.isAlert).length,
  );

  const navigate = useNavigate();

  // P7: pass navigate to useEventStream; P5: receive connectionState
  const { connectionState } = useEventStream(navigate);

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
  }, [measureBanner, isOnline, updateAvailable, canInstall, apiConnected, alertCount]);

  // Scroll to top on route change, but skip detail pages (they restore scroll position)
  useEffect(() => {
    // Don't scroll for detail pages — PageDetailPage handles scroll restoration
    if (!location.pathname.match(/^\/(s|e|c|y)\//)) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname]);

  return (
    <div className="h-screen bg-[var(--bg-primary)] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-apple-blue focus:text-white focus:font-medium"
      >
        {t('action.skipToContent', 'Skip to content')}
      </a>
      <Header connectionState={connectionState} />
      <ToastContainer />
      <IngestProgress />
      <CommandPalette />
      <div ref={bannerRef} className="fixed top-14 left-0 right-0 z-[45]">
        <AlertBanner
          isOffline={!isOnline}
          isBackendOffline={isOnline && !apiConnected}
          hasPwaUpdate={updateAvailable}
          showPwaInstall={canInstall && isOnline && !updateAvailable}
          onPwaUpdate={applyUpdate}
          onPwaInstall={install}
        />
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
          className={`flex-1 transition-all duration-300 overflow-y-auto ${sidebarCollapsed ? 'md:ml-14' : 'md:ml-60'}`}
        >
          <div className={isGraphPage ? 'h-full' : 'max-w-5xl mx-auto px-4 sm:px-6 py-1 min-h-full flex flex-col'}>
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
              <AnimatePresence mode="wait" initial={false}>
                <PageTransition key={location.pathname} pathname={location.pathname} isGraphPage={isGraphPage}>
                  {element}
                </PageTransition>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>
      <ScrollToTop />
    </div>
  );
}
