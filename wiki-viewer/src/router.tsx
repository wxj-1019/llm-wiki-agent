import { createBrowserRouter, useRouteError } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/components/pages/HomePage';
import { BrowsePage } from '@/components/pages/BrowsePage';
import { PageDetailPage } from '@/components/pages/PageDetailPage';
import { GraphPage } from '@/components/pages/GraphPage';
import { SearchPage } from '@/components/pages/SearchPage';
import { LogPage } from '@/components/pages/LogPage';
import { UploadPage } from '@/components/pages/UploadPage';
import { NotFoundPage } from '@/components/pages/NotFoundPage';

function ErrorBoundary() {
  const error = useRouteError() as Error;
  console.error('Router error:', error);
  return (
    <div style={{ padding: 24, fontFamily: 'monospace', background: '#fee', color: '#c00', minHeight: '100vh' }}>
      <h1>Application Error</h1>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {error?.stack || String(error)}
      </pre>
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
      { path: '/graph', element: <GraphPage />, errorElement: <ErrorBoundary /> },
      { path: '/search', element: <SearchPage />, errorElement: <ErrorBoundary /> },
      { path: '/log', element: <LogPage />, errorElement: <ErrorBoundary /> },
      { path: '/upload', element: <UploadPage />, errorElement: <ErrorBoundary /> },
      { path: '*', element: <NotFoundPage />, errorElement: <ErrorBoundary /> },
    ],
  },
]);
