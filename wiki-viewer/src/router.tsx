import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/components/pages/HomePage';
import { BrowsePage } from '@/components/pages/BrowsePage';
import { PageDetailPage } from '@/components/pages/PageDetailPage';
import { SearchPage } from '@/components/pages/SearchPage';
import { LogPage } from '@/components/pages/LogPage';
import { StatusPage } from '@/components/pages/StatusPage';
import { NotFoundPage } from '@/components/pages/NotFoundPage';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { lazy, Suspense, type ReactNode } from 'react';

// Lazy-load heavy / less frequently visited pages
const GraphPage = lazy(() => import('@/components/pages/GraphPage').then((m) => ({ default: m.GraphPage })));
const ChatPage = lazy(() => import('@/components/pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const UploadPage = lazy(() => import('@/components/pages/UploadPage').then((m) => ({ default: m.UploadPage })));
const DashboardPage = lazy(() => import('@/components/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MindmapPage = lazy(() => import('@/components/pages/MindmapPage').then((m) => ({ default: m.MindmapPage })));
const TimelinePage = lazy(() => import('@/components/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const MCPPage = lazy(() => import('@/components/pages/MCPPage').then((m) => ({ default: m.MCPPage })));
const SkillsPage = lazy(() => import('@/components/pages/SkillsPage').then((m) => ({ default: m.SkillsPage })));

// eslint-disable-next-line react-refresh/only-export-components
function PageLoader({ label }: { label: string }) {
  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">Loading {label}...</p>
      </div>
    </div>
  );
}

// Wrap lazy-loaded pages with their own error boundary so a crash in one
// doesn't bring down the entire app.
function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader label="page" />}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/', element: <HomePage />, errorElement: <ErrorBoundary /> },
      { path: '/browse', element: <BrowsePage />, errorElement: <ErrorBoundary /> },
      { path: '/s/:slug', element: <PageDetailPage type='source' />, errorElement: <ErrorBoundary /> },
      { path: '/e/:name', element: <PageDetailPage type='entity' />, errorElement: <ErrorBoundary /> },
      { path: '/c/:name', element: <PageDetailPage type='concept' />, errorElement: <ErrorBoundary /> },
      { path: '/y/:slug', element: <PageDetailPage type='synthesis' />, errorElement: <ErrorBoundary /> },
      { path: '/graph', element: <LazyPage><GraphPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/search', element: <SearchPage />, errorElement: <ErrorBoundary /> },
      { path: '/log', element: <LogPage />, errorElement: <ErrorBoundary /> },
      { path: '/upload', element: <LazyPage><UploadPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/settings', element: <LazyPage><SettingsPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/chat', element: <LazyPage><ChatPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/status', element: <StatusPage />, errorElement: <ErrorBoundary /> },
      { path: '/mcp', element: <LazyPage><MCPPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/skills', element: <LazyPage><SkillsPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/dashboard', element: <LazyPage><DashboardPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/mindmap/:slug', element: <LazyPage><MindmapPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/timeline', element: <LazyPage><TimelinePage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '*', element: <NotFoundPage />, errorElement: <ErrorBoundary /> },
    ],
  },
]);
