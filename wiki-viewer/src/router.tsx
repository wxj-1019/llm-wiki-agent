import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/components/pages/HomePage';
import { BrowsePage } from '@/components/pages/BrowsePage';
import { PageDetailPage } from '@/components/pages/PageDetailPage';
import { GraphPage } from '@/components/pages/GraphPage';
import { SearchPage } from '@/components/pages/SearchPage';
import { LogPage } from '@/components/pages/LogPage';
import { NotFoundPage } from '@/components/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/browse', element: <BrowsePage /> },
      { path: '/s/:slug', element: <PageDetailPage type='source' /> },
      { path: '/e/:name', element: <PageDetailPage type='entity' /> },
      { path: '/c/:name', element: <PageDetailPage type='concept' /> },
      { path: '/y/:slug', element: <PageDetailPage type='synthesis' /> },
      { path: '/graph', element: <GraphPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/log', element: <LogPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
