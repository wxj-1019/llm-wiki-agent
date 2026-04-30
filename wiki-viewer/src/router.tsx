import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/components/pages/HomePage';
import { BrowsePage } from '@/components/pages/BrowsePage';
import { PageDetailPage } from '@/components/pages/PageDetailPage';
import { SearchPage } from '@/components/pages/SearchPage';
import { LogPage } from '@/components/pages/LogPage';
import { UploadPage } from '@/components/pages/UploadPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { AgentKitPage } from '@/components/agent-kit/AgentKitPage';
import { StatusPage } from '@/components/pages/StatusPage';
import { NotFoundPage } from '@/components/pages/NotFoundPage';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { lazy, Suspense } from 'react';

const GraphPage = lazy(() => import('@/components/pages/GraphPage').then((m) => ({ default: m.GraphPage })));

// eslint-disable-next-line react-refresh/only-export-components
function GraphPageLoader() {
  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">Loading graph...</p>
      </div>
    </div>
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
      { path: '/graph', element: (
        <Suspense fallback={<GraphPageLoader />}>
          <GraphPage />
        </Suspense>
      ), errorElement: <ErrorBoundary /> },
      { path: '/search', element: <SearchPage />, errorElement: <ErrorBoundary /> },
      { path: '/log', element: <LogPage />, errorElement: <ErrorBoundary /> },
      { path: '/upload', element: <UploadPage />, errorElement: <ErrorBoundary /> },
      { path: '/settings', element: <SettingsPage />, errorElement: <ErrorBoundary /> },
      { path: '/agent-kit', element: <AgentKitPage />, errorElement: <ErrorBoundary /> },
      { path: '/status', element: <StatusPage />, errorElement: <ErrorBoundary /> },
      { path: '*', element: <NotFoundPage />, errorElement: <ErrorBoundary /> },
    ],
  },
]);
